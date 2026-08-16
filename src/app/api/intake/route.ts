import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { corsHeaders } from "@/lib/http/landing-cors";
import { intakePayloadSchema } from "@/lib/leads/intake-schema";
import { mapIntakePayload } from "@/lib/leads/map-intake";
import { PayloadMappingError } from "@/lib/leads/map-payload";
import { logger, maskPhone } from "@/lib/logger";

// crypto + DB → runtime Node.
export const runtime = "nodejs";

const log = logger.child({ route: "POST /api/intake" });

export function OPTIONS(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

// ── Rate-limit en memoria (por IP). Simple; se endurece con captcha en Fase 2. ──
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 8;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear(); // guard de memoria
  return arr.length > MAX_PER_WINDOW;
}

function clientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip");
}

function json(body: unknown, status: number, req: Request): Response {
  return NextResponse.json(body, { status, headers: corsHeaders(req) });
}

export async function POST(req: Request): Promise<Response> {
  try {
    const raw = await req.text();
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return json({ error: "invalid json" }, 400, req);
    }

    // 1. Honeypot: si el campo oculto viene lleno, es bot → 200 silencioso.
    if (typeof (body as { hp?: unknown }).hp === "string" && (body as { hp: string }).hp.trim() !== "") {
      log.warn("honeypot activado (bot)");
      return json({ ok: true }, 200, req); // fingimos éxito
    }

    // 2. Rate-limit por IP.
    const ip = clientIp(req);
    if (ip && rateLimited(ip)) {
      log.warn({ ip }, "rate limit");
      return json({ error: "too many requests" }, 429, req);
    }

    // 3. Validar el payload.
    const parsed = intakePayloadSchema.safeParse(body);
    if (!parsed.success) {
      return json({ error: "invalid payload", issues: parsed.error.issues }, 400, req);
    }
    const payload = parsed.data;

    // 4. Mapear.
    const externalId = payload.submitId ?? randomUUID();
    let mapped;
    try {
      mapped = mapIntakePayload(payload, externalId, ip);
    } catch (e) {
      if (e instanceof PayloadMappingError) {
        return json({ error: e.reason }, 400, req);
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

    const logCtx = { externalId, phone: maskPhone(mapped.customerPhone), provinceId: mapped.customerProvinceId, offerId };
    if (mapped.customerProvinceId === null) {
      log.warn(logCtx, "provincia no resuelta a ID (revisar antes de pushear)");
    }

    // 6. Idempotencia por (externalId, platform).
    const existing = await prisma.lead.findUnique({
      where: { externalId_platform: { externalId, platform: mapped.platform } },
      select: { id: true },
    });
    if (existing) {
      return json({ ok: true, lead_id: existing.id, duplicate: true }, 200, req);
    }

    // 7. Crear el lead.
    try {
      const lead = await prisma.lead.create({
        data: {
          externalId,
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
          customerIp: mapped.customerIp,
          quantity: mapped.quantity,
          totalPriceLocal: mapped.totalPriceLocal,
          landingId: mapped.landingId,
          pixelId: mapped.pixelId,
          fbp: mapped.fbp,
          fbc: mapped.fbc,
          fbclid: mapped.fbclid,
          utmSource: mapped.utmSource,
          utmCampaign: mapped.utmCampaign,
          utmContent: mapped.utmContent,
          utmTerm: mapped.utmTerm,
          rawPayload: body as Prisma.InputJsonValue,
          statusHistory: {
            create: { newStatus: "pending", source: "system", note: "ingested from landing propia (/api/intake)" },
          },
        },
        select: { id: true },
      });
      log.info({ ...logCtx, leadId: lead.id }, "lead creado");
      // Recuperación: si había un carrito abandonado con este submitId, marcarlo
      // recuperado para que NO dispare el webhook.
      try {
        await prisma.abandonedCart.updateMany({
          where: { submitId: externalId, recovered: false },
          data: { recovered: true, recoveredLeadId: lead.id },
        });
      } catch {
        /* best-effort */
      }
      return json({ ok: true, lead_id: lead.id }, 200, req);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const dup = await prisma.lead.findUnique({
          where: { externalId_platform: { externalId, platform: mapped.platform } },
          select: { id: true },
        });
        return json({ ok: true, lead_id: dup?.id ?? null, duplicate: true }, 200, req);
      }
      throw e;
    }
  } catch (err) {
    log.error(
      { err: err instanceof Error ? { message: err.message, stack: err.stack } : err },
      "error inesperado en intake",
    );
    return json({ error: "internal error" }, 500, req);
  }
}
