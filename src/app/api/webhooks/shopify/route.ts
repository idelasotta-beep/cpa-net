import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { verifyShopifyWebhook } from "@/lib/hmac";
import { mapShopifyOrder } from "@/lib/leads/map-shopify-order";
import { PayloadMappingError } from "@/lib/leads/map-payload";
import { shopifyOrderSchema } from "@/lib/leads/shopify-webhook-schema";
import { logger, maskPhone } from "@/lib/logger";

// Necesitamos runtime Node (crypto + raw body), no Edge.
export const runtime = "nodejs";

const log = logger.child({ route: "POST /api/webhooks/shopify" });

const SIGNATURE_HEADER = "x-shopify-hmac-sha256";

export async function POST(req: Request): Promise<Response> {
  try {
    // 1. RAW body (crítico para HMAC: no re-serializar).
    const rawBody = await req.text();

    // 2. Verificar firma HMAC (base64) si hay secreto configurado.
    if (env.SHOPIFY_WEBHOOK_SECRET) {
      const signature = req.headers.get(SIGNATURE_HEADER);
      const ok = verifyShopifyWebhook(
        rawBody,
        signature,
        env.SHOPIFY_WEBHOOK_SECRET,
      );
      if (!ok) {
        log.warn({ hasSignature: Boolean(signature) }, "firma HMAC inválida");
        return NextResponse.json({ error: "invalid signature" }, { status: 401 });
      }
    } else {
      log.warn("SHOPIFY_WEBHOOK_SECRET no configurado: verificación HMAC omitida");
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
    const parsed = shopifyOrderSchema.safeParse(json);
    if (!parsed.success) {
      log.warn({ issues: parsed.error.issues }, "payload inválido");
      return NextResponse.json(
        { error: "invalid payload", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const order = parsed.data;

    // 5. Filtro por app de Releasit (opcional): descartar órdenes de otras apps
    //    (ej. creadas a mano en el admin). Vacío = ingerir todas. 200 para no reintentar.
    if (
      env.SHOPIFY_RELEASIT_APP_ID &&
      order.app_id !== env.SHOPIFY_RELEASIT_APP_ID
    ) {
      log.info({ appId: order.app_id }, "orden ignorada (app_id != Releasit)");
      return NextResponse.json({ status: "ignored", reason: "app_id" });
    }

    // 6. Mapear orden -> datos del lead.
    let mapped;
    try {
      mapped = mapShopifyOrder(order);
    } catch (e) {
      if (e instanceof PayloadMappingError) {
        log.error({ reason: e.reason, message: e.message }, "mapeo de orden falló");
        return NextResponse.json({ status: "ignored", reason: e.reason });
      }
      throw e;
    }

    // 7. Resolver la oferta por SKU (platformProductId). Puede no haber mapeo aún.
    let offerId: string | null = null;
    if (mapped.platformProductId) {
      const offer = await prisma.offer.findFirst({
        where: { platformProductId: mapped.platformProductId, active: true },
        select: { id: true },
      });
      offerId = offer?.id ?? null;
      if (!offerId) {
        log.warn(
          { sku: mapped.platformProductId },
          "sin oferta mapeada para el SKU; lead se crea con offerId null",
        );
      }
    } else {
      log.warn("orden sin SKU; lead se crea con offerId null");
    }

    const logCtx = {
      externalId: mapped.externalId,
      phone: maskPhone(mapped.customerPhone),
      provinceId: mapped.customerProvinceId,
      offerId,
    };

    if (mapped.customerProvinceId === null) {
      log.warn(
        { ...logCtx, region: mapped.customerRegion },
        "provincia no resuelta a ID EcomLatam (revisar antes de pushear)",
      );
    }

    // 8. Idempotencia por (externalId, platform).
    const existing = await prisma.lead.findUnique({
      where: {
        externalId_platform: {
          externalId: mapped.externalId,
          platform: mapped.platform,
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
          rawPayload: json as Prisma.InputJsonValue, // JSON original (forensics)
          statusHistory: {
            create: {
              newStatus: "pending",
              source: "system",
              note: "ingested from Shopify/Releasit webhook",
            },
          },
        },
        select: { id: true },
      });

      log.info({ ...logCtx, leadId: lead.id }, "lead creado");
      return NextResponse.json({ status: "created", lead_id: lead.id });
    } catch (e) {
      // Carrera: otro request creó el mismo (externalId, platform) en paralelo.
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        const dup = await prisma.lead.findUnique({
          where: {
            externalId_platform: {
              externalId: mapped.externalId,
              platform: mapped.platform,
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
      "error inesperado procesando webhook de Shopify",
    );
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
