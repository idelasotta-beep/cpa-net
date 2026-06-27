import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/cron-auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { adcomboClient } from "@/lib/networks/adcombo/client";
import { OFFER_PRODUCT_MAPPING } from "@/lib/offer-mapping";

export const runtime = "nodejs";
export const maxDuration = 60;

const log = logger.child({ route: "POST /api/admin/offers/sync" });

/**
 * Trae el catálogo de Adcombo y hace upsert en `offers`.
 * No pisa `platformProductId` salvo lo que defina OFFER_PRODUCT_MAPPING.
 */
export async function POST(req: Request): Promise<Response> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    // Asegurar que exista la red adcombo.
    const network = await prisma.network.upsert({
      where: { slug: "adcombo" },
      update: { name: "Adcombo", active: true },
      create: { slug: "adcombo", name: "Adcombo", active: true },
    });

    const offers = await adcomboClient.loadOffers();
    let upserted = 0;
    for (const o of offers) {
      await prisma.offer.upsert({
        where: {
          networkId_networkOfferId: {
            networkId: network.id,
            networkOfferId: o.networkOfferId,
          },
        },
        update: {
          name: o.name,
          country: o.country,
          payoutUsd: o.payoutUsd,
          priceLocal: o.priceLocal,
          // Convención del usuario: el dropi_product_id en EstrategiasIA = offer_id Adcombo.
          platformProductId: o.networkOfferId,
        },
        create: {
          networkId: network.id,
          networkOfferId: o.networkOfferId,
          name: o.name,
          country: o.country,
          payoutUsd: o.payoutUsd,
          priceLocal: o.priceLocal,
          platformProductId: o.networkOfferId,
        },
      });
      upserted++;
    }

    // Aplicar el mapeo producto→oferta (setea platformProductId).
    let mapped = 0;
    for (const [networkOfferId, platformProductId] of Object.entries(
      OFFER_PRODUCT_MAPPING,
    )) {
      const r = await prisma.offer.updateMany({
        where: { networkId: network.id, networkOfferId },
        data: { platformProductId },
      });
      mapped += r.count;
    }

    log.info({ upserted, mapped }, "sync de ofertas completado");
    return NextResponse.json({ status: "ok", upserted, mapped });
  } catch (err) {
    log.error(
      { err: err instanceof Error ? { message: err.message, stack: err.stack } : err },
      "sync de ofertas falló",
    );
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
