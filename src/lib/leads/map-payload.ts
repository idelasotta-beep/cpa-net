import { LeadSource } from "@prisma/client";
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

/** Mapea order.created_via al enum canónico LeadSource. */
function mapSource(createdVia: string): LeadSource {
  switch (createdVia.trim().toLowerCase()) {
    case "shopify":
      return LeadSource.shopify;
    case "whatsapp_ai":
      return LeadSource.whatsapp_ai;
    default:
      throw new PayloadMappingError(
        `created_via desconocido: "${createdVia}"`,
        "unknown_source",
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
  source: LeadSource;
  /** clave para resolver la oferta (= items[0].dropi_product_id), puede ser null */
  platformProductId: string | null;
  customerName: string;
  customerPhone: string;
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
    source: mapSource(order.created_via),
    platformProductId: firstItem?.dropi_product_id ?? null,
    customerName: fullName,
    customerPhone: order.customer.phone.trim(),
    customerCity: emptyToNull(order.shipping_city),
    customerRegion: emptyToNull(order.shipping_state),
    customerCountry: store.country.trim(),
    utmSource: emptyToNull(order.utm_source),
    utmCampaign: emptyToNull(order.utm_campaign),
    utmContent: emptyToNull(order.utm_content),
    utmTerm: emptyToNull(order.utm_term),
  };
}
