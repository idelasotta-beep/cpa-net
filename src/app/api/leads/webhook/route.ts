import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { verifyEstrategasSignature } from "@/lib/hmac";
import { mapWebhookPayload, PayloadMappingError } from "@/lib/leads/map-payload";
import { webhookPayloadSchema } from "@/lib/leads/webhook-schema";
import { logger, maskPhone } from "@/lib/logger";

// Necesitamos runtime Node (crypto + raw body), no Edge.
export const runtime = "nodejs";

const log = logger.child({ route: "POST /api/leads/webhook" });

const SIGNATURE_HEADER = "x-estrategas-signature";

export async function POST(req: Request): Promise<Response> {
  try {
    // 1. Leer el RAW body (crítico para HMAC: no re-serializar).
    const rawBody = await req.text();

    // 2. Verificar firma HMAC si hay secreto configurado.
    if (env.PLATFORM_WEBHOOK_SECRET) {
      const signature = req.headers.get(SIGNATURE_HEADER);
      const ok = verifyEstrategasSignature(
        rawBody,
        signature,
        env.PLATFORM_WEBHOOK_SECRET,
      );
      if (!ok) {
        log.warn({ hasSignature: Boolean(signature) }, "firma HMAC inválida");
        return NextResponse.json({ error: "invalid signature" }, { status: 401 });
      }
    } else {
      log.warn("PLATFORM_WEBHOOK_SECRET no configurado: verificación HMAC omitida");
    }

    // 3. Parsear JSON.
    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      log.warn("body no es JSON válido");
      return NextResponse.json({ error: "invalid json" }, { status: 400 });
    }

    // 4. Validar estructura.
    const parsed = webhookPayloadSchema.safeParse(json);
    if (!parsed.success) {
      log.warn({ issues: parsed.error.issues }, "payload inválido");
      return NextResponse.json(
        { error: "invalid payload", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const payload = parsed.data;

    // 5. Ignorar eventos que no sean order.created (200 para no inducir reintentos).
    if (payload.event !== "order.created") {
      log.info({ event: payload.event }, "evento ignorado (no order.created)");
      return NextResponse.json({ status: "ignored", reason: "event" });
    }

    // 6. Mapear payload -> datos del lead.
    let mapped;
    try {
      mapped = mapWebhookPayload(payload);
    } catch (e) {
      if (e instanceof PayloadMappingError) {
        log.error({ reason: e.reason, message: e.message }, "mapeo de payload falló");
        return NextResponse.json({ status: "ignored", reason: e.reason });
      }
      throw e;
    }

    // 7. Resolver la oferta por platformProductId (puede no haber mapeo aún).
    let offerId: string | null = null;
    if (mapped.platformProductId) {
      const offer = await prisma.offer.findFirst({
        where: { platformProductId: mapped.platformProductId, active: true },
        select: { id: true },
      });
      offerId = offer?.id ?? null;
      if (!offerId) {
        log.warn(
          { platformProductId: mapped.platformProductId },
          "sin oferta mapeada para el producto; lead se crea con offerId null",
        );
      }
    } else {
      log.warn("payload sin platformProductId; lead se crea con offerId null");
    }

    const logCtx = {
      externalId: mapped.externalId,
      source: mapped.source,
      phone: maskPhone(mapped.customerPhone),
      offerId,
    };

    // 8. Idempotencia: si ya existe (externalId, source), no duplicar.
    const existing = await prisma.lead.findUnique({
      where: {
        externalId_source: {
          externalId: mapped.externalId,
          source: mapped.source,
        },
      },
      select: { id: true },
    });
    if (existing) {
      log.info({ ...logCtx, leadId: existing.id }, "lead duplicado (idempotencia)");
      return NextResponse.json({ status: "duplicate", lead_id: existing.id });
    }

    // 9. Crear el lead + entrada inicial de historial (atómico).
    try {
      const lead = await prisma.lead.create({
        data: {
          externalId: mapped.externalId,
          source: mapped.source,
          offerId,
          status: "pending",
          customerName: mapped.customerName,
          customerPhone: mapped.customerPhone,
          customerAddress: mapped.customerAddress,
          customerCity: mapped.customerCity,
          customerRegion: mapped.customerRegion,
          customerCountry: mapped.customerCountry,
          utmSource: mapped.utmSource,
          utmCampaign: mapped.utmCampaign,
          utmContent: mapped.utmContent,
          utmTerm: mapped.utmTerm,
          rawPayload: payload as unknown as Prisma.InputJsonValue,
          statusHistory: {
            create: {
              newStatus: "pending",
              source: "system",
              note: "ingested from EstrategiasIA webhook",
            },
          },
        },
        select: { id: true },
      });

      log.info({ ...logCtx, leadId: lead.id }, "lead creado");
      return NextResponse.json({ status: "created", lead_id: lead.id });
    } catch (e) {
      // Carrera: otro request creó el mismo (externalId, source) en paralelo.
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        const dup = await prisma.lead.findUnique({
          where: {
            externalId_source: {
              externalId: mapped.externalId,
              source: mapped.source,
            },
          },
          select: { id: true },
        });
        log.info({ ...logCtx, leadId: dup?.id }, "lead duplicado (carrera P2002)");
        return NextResponse.json({ status: "duplicate", lead_id: dup?.id ?? null });
      }
      throw e;
    }
  } catch (err) {
    log.error(
      { err: err instanceof Error ? { message: err.message, stack: err.stack } : err },
      "error inesperado procesando webhook",
    );
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
