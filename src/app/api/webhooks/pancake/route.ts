import { timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { mapPancakePayload } from "@/lib/leads/map-pancake";
import { PayloadMappingError } from "@/lib/leads/map-payload";
import { pancakePayloadSchema } from "@/lib/leads/pancake-schema";
import { logger, maskPhone } from "@/lib/logger";

/**
 * Ingesta de leads de Pancake (WhatsApp/omnichannel) → crea Lead pending que el job
 * push-pending envía a la red CPA. Pancake manda los campos en la pestaña Params (query
 * string) y/o body JSON; auth por `Authorization: Bearer <secreto>` o `?token=`.
 *
 * Meta: hoy Pancake dispara su propio CAPI, y el postback-handler NO dispara Purchase
 * para platform=pancake (solo shopify/landing) → sin doble conteo. Igualmente capturamos
 * los IDs de Meta si vienen (ver pancake-schema) para poder cambiar de estrategia sin
 * re-tocar la ingesta.
 */

// crypto + DB → runtime Node.
export const runtime = "nodejs";

const log = logger.child({ route: "/api/webhooks/pancake" });

/** Comparación en tiempo constante contra PANCAKE_WEBHOOK_SECRET. Vacío = omitida (dev). */
function tokenOk(received: string | null): boolean {
  const expected = env.PANCAKE_WEBHOOK_SECRET;
  if (!expected) {
    log.warn("PANCAKE_WEBHOOK_SECRET no configurado: auth omitida");
    return true;
  }
  if (!received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function bearer(req: Request): string | null {
  const h = req.headers.get("authorization");
  return h && /^Bearer\s+/i.test(h) ? h.replace(/^Bearer\s+/i, "").trim() : null;
}

async function handle(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);

    // 1. Auth: header Bearer o ?token=.
    if (!tokenOk(bearer(req) ?? url.searchParams.get("token"))) {
      log.warn("token inválido");
      return NextResponse.json({ error: "invalid token" }, { status: 401 });
    }

    // 2. Reunir campos: query params (Params/URL) + body JSON si viene. El `token` no se
    //    incluye (no se persiste en rawPayload).
    const input: Record<string, unknown> = {};
    url.searchParams.forEach((v, k) => {
      if (k !== "token") input[k] = v;
    });
    const rawBody = await req.text();
    if (rawBody && rawBody.trim()) {
      try {
        const parsed = JSON.parse(rawBody);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          Object.assign(input, parsed as Record<string, unknown>);
          delete input.token;
        }
      } catch {
        /* body no-JSON → se ignora; ya tenemos los query params */
      }
    }

    // 3. Validar.
    const parsed = pancakePayloadSchema.safeParse(input);
    if (!parsed.success) {
      log.warn({ issues: parsed.error.issues }, "payload inválido");
      return NextResponse.json({ error: "invalid payload", issues: parsed.error.issues }, { status: 400 });
    }

    // 4. Mapear.
    let mapped;
    try {
      mapped = mapPancakePayload(parsed.data);
    } catch (e) {
      if (e instanceof PayloadMappingError) {
        log.warn({ reason: e.reason }, "mapeo de payload falló");
        return NextResponse.json({ status: "ignored", reason: e.reason }, { status: 400 });
      }
      throw e;
    }

    // 5. Resolver la oferta por SKU (platformProductId).
    let offerId: string | null = null;
    if (mapped.platformProductId) {
      const offer = await prisma.offer.findFirst({
        where: { platformProductId: mapped.platformProductId, active: true },
        select: { id: true },
      });
      offerId = offer?.id ?? null;
      if (!offerId) log.warn({ sku: mapped.platformProductId }, "SKU sin oferta mapeada");
    }

    const logCtx = {
      externalId: mapped.externalId,
      phone: maskPhone(mapped.customerPhone),
      provinceId: mapped.customerProvinceId,
      offerId,
    };
    if (mapped.customerProvinceId === null) {
      log.warn(logCtx, "provincia no resuelta a ID (revisar antes de pushear)");
    }

    // 6. Idempotencia por (externalId, platform).
    const existing = await prisma.lead.findUnique({
      where: { externalId_platform: { externalId: mapped.externalId, platform: mapped.platform } },
      select: { id: true },
    });
    if (existing) {
      log.info({ ...logCtx, leadId: existing.id }, "lead duplicado (idempotencia)");
      return NextResponse.json({ status: "duplicate", lead_id: existing.id });
    }

    // 7. Crear el lead + entrada inicial de historial (atómico).
    try {
      const lead = await prisma.lead.create({
        data: {
          externalId: mapped.externalId,
          platform: mapped.platform,
          channel: mapped.channel,
          offerId,
          status: "pending",
          customerName: mapped.customerName,
          customerPhone: mapped.customerPhone,
          customerEmail: mapped.customerEmail,
          customerAddress: mapped.customerAddress,
          customerCity: mapped.customerCity,
          customerRegion: mapped.customerRegion,
          customerCountry: mapped.customerCountry,
          customerStreet: mapped.customerStreet,
          customerStreetNumber: mapped.customerStreetNumber,
          customerPostalCode: mapped.customerPostalCode,
          customerProvinceId: mapped.customerProvinceId,
          customerFloor: mapped.customerFloor,
          customerApartment: mapped.customerApartment,
          customerBetweenStreets: mapped.customerBetweenStreets,
          customerShippingNotes: mapped.customerShippingNotes,
          quantity: mapped.quantity,
          totalPriceLocal: mapped.totalPriceLocal,
          pixelId: mapped.pixelId,
          fbp: mapped.fbp,
          fbc: mapped.fbc,
          fbclid: mapped.fbclid,
          utmSource: mapped.utmSource,
          utmCampaign: mapped.utmCampaign,
          utmContent: mapped.utmContent,
          utmTerm: mapped.utmTerm,
          rawPayload: input as Prisma.InputJsonValue, // params originales (forensics)
          statusHistory: {
            create: { newStatus: "pending", source: "system", note: "ingested from Pancake webhook" },
          },
        },
        select: { id: true },
      });
      log.info({ ...logCtx, leadId: lead.id }, "lead creado (pancake)");
      return NextResponse.json({ status: "created", lead_id: lead.id });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const dup = await prisma.lead.findUnique({
          where: { externalId_platform: { externalId: mapped.externalId, platform: mapped.platform } },
          select: { id: true },
        });
        return NextResponse.json({ status: "duplicate", lead_id: dup?.id ?? null });
      }
      throw e;
    }
  } catch (err) {
    log.error(
      { err: err instanceof Error ? { message: err.message, stack: err.stack } : err },
      "error inesperado procesando webhook de Pancake",
    );
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

export const POST = handle;
export const GET = handle;
