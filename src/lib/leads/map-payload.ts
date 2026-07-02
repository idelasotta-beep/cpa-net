import { Channel, Platform } from "@prisma/client";
import type { WebhookPayload } from "./webhook-schema";

/**
 * Error de mapeo de negocio (payload válido sintácticamente pero no procesable).
 * El endpoint lo trata logueando + 200 para no inducir reintentos infinitos.
 */
export class PayloadMappingError extends Error {
  constructor(
    message: string,
    public readonly reason: string,
  ) {
    super(message);
    this.name = "PayloadMappingError";
  }
}

/** Mapea order.created_via de EstrategiasIA al canal canónico. */
function mapChannel(createdVia: string): Channel {
  switch (createdVia.trim().toLowerCase()) {
    case "shopify":
      return Channel.shopify;
    case "whatsapp_ai":
    case "whatsapp":
      return Channel.whatsapp;
    default:
      throw new PayloadMappingError(
        `created_via desconocido: "${createdVia}"`,
        "unknown_channel",
      );
  }
}

function emptyToNull(v: string | undefined | null): string | null {
  if (v === undefined || v === null) return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

export interface MappedLead {
  externalId: string;
  platform: Platform;
  channel: Channel;
  /** clave para resolver la oferta (= items[0].dropi_product_id), puede ser null */
  platformProductId: string | null;
  customerName: string;
  customerPhone: string;
  customerAddress: string | null;
  customerCity: string | null;
  customerRegion: string | null;
  customerCountry: string;
  utmSource: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
}

/**
 * Normaliza el payload de EstrategiasIA a los campos del lead.
 * No toca la base de datos; solo transforma. Lanza PayloadMappingError si el
 * origen es desconocido.
 */
export function mapWebhookPayload(payload: WebhookPayload): MappedLead {
  const { order, store } = payload;

  const fullName = [order.customer.name, order.customer.surname]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(" ");

  const firstItem = order.items[0];

  return {
    externalId: order.number,
    platform: Platform.estrategias,
    channel: mapChannel(order.created_via),
    platformProductId: firstItem?.dropi_product_id ?? null,
    customerName: fullName,
    customerPhone: order.customer.phone.trim(),
    customerAddress: emptyToNull(order.shipping?.address),
    customerCity: emptyToNull(order.shipping?.city),
    customerRegion: emptyToNull(order.shipping?.state),
    customerCountry: store.country.trim(),
    utmSource: emptyToNull(order.utm?.source),
    utmCampaign: emptyToNull(order.utm?.campaign),
    utmContent: emptyToNull(order.utm?.content),
    utmTerm: emptyToNull(order.utm?.term),
  };
}
