import type { Lead, Offer } from "@prisma/client";
import { env } from "@/lib/env";
import { logger, maskPhone } from "@/lib/logger";
import type {
  CanonicalStatus,
  CreateOrderResult,
  NetworkStatusResult,
  NormalizedOffer,
  OfferNetworkClient,
} from "../types";
import type { EcomlatamCreateResponse } from "./latinecom.types";

const log = logger.child({ network: "latinecom" });

/**
 * Traduce el status del POSTBACK de Latinecom al canónico.
 * Outcomes de Latinecom: Sales / Hold / Rejected / Trash.
 * "unknown" => no tocar el estado local.
 */
export function mapStatus(status: string): CanonicalStatus | "unknown" {
  switch (status.trim().toLowerCase()) {
    case "sale":
    case "sales":
    case "confirmed":
      return "lead";
    case "hold":
      return "hold";
    case "rejected":
    case "reject":
    case "cancelled":
      return "reject";
    case "trash":
    case "trashed":
      return "trash";
    default:
      return "unknown";
  }
}

function requireApiKey(): string {
  if (!env.LATINECOM_API_KEY) {
    throw new Error("LATINECOM_API_KEY no está configurada");
  }
  return env.LATINECOM_API_KEY;
}

/** Campos que Latinecom exige sí o sí. Sin ellos el lead va a papelera → no gastamos el request. */
function missingRequiredFields(lead: Lead): string[] {
  const missing: string[] = [];
  if (!lead.customerName?.trim()) missing.push("name");
  if (!lead.customerPhone?.trim()) missing.push("phone");
  if (!lead.customerStreet?.trim()) missing.push("street");
  if (!lead.customerStreetNumber?.trim()) missing.push("streetNumber");
  if (!lead.customerCity?.trim()) missing.push("city");
  if (!lead.customerPostalCode?.trim()) missing.push("postalCode");
  if (lead.customerProvinceId == null) missing.push("provinceId");
  return missing;
}

const truthy = (v: unknown): boolean =>
  v === true || v === "true" || v === 1 || v === "1";

const nonEmpty = (v: unknown): boolean =>
  v != null && (typeof v !== "object" || Object.keys(v as object).length > 0) && v !== "";

/**
 * Detecta si un 200 en realidad fue a papelera. Devuelve el motivo (string) o null.
 * Sondea las múltiples marcas que usa Latinecom (ver EcomlatamCreateResponse).
 */
export function detectTrash(d: EcomlatamCreateResponse): string | null {
  if (
    truthy(d.autoTrash) ||
    truthy(d.autoTrashed) ||
    truthy(d.isTrash) ||
    truthy(d.isTrashed) ||
    truthy(d.trashed)
  ) {
    return "autoTrash";
  }

  const statusStr = typeof d.status === "string" ? d.status.toLowerCase() : "";
  if (statusStr === "trash" || statusStr === "trashed") return `status=${d.status}`;

  const nested = d.lead?.status ?? d.data?.status;
  if (typeof nested === "string" && nested.toLowerCase() === "trash") {
    return "status anidado=trash";
  }

  if (nonEmpty(d.validationErrors)) return "validationErrors";
  if (nonEmpty(d.errors)) return "errors";

  const msg = typeof d.message === "string" ? d.message : "";
  if (
    /duplicate|already submitted|product item association failed|validation failed|lead duplicado|missing_note_attribute|invalid_/i.test(
      msg,
    )
  ) {
    return msg;
  }

  const reason = d.trashReason ?? d.lead?.trashReason ?? d.warning;
  if (typeof reason === "string" && reason.trim()) return reason;

  return null;
}

function extractNetworkLeadId(d: EcomlatamCreateResponse): string | null {
  const id = d.orderId ?? d.leadNumber ?? d.id ?? d.lead?.id;
  return id != null ? String(id) : null;
}

export const latinecomClient: OfferNetworkClient = {
  slug: "latinecom",

  async createOrder(lead: Lead, offer: Offer): Promise<CreateOrderResult> {
    try {
      const apiKey = requireApiKey();

      // Pre-validación: si falta un campo obligatorio, Latinecom lo tira a trash.
      // Cortamos acá para no gastar el request y marcar el estado terminal directo.
      const missing = missingRequiredFields(lead);
      if (missing.length > 0) {
        return {
          ok: false,
          terminalStatus: "trash",
          note: `faltan campos requeridos: ${missing.join(", ")}`,
        };
      }

      const body: Record<string, unknown> = {
        productSku: offer.networkOfferId,
        customerName: lead.customerName,
        customerPhone: lead.customerPhone,
        customerStreet: lead.customerStreet,
        customerStreetNumber: lead.customerStreetNumber,
        customerCity: lead.customerCity,
        customerPostalCode: lead.customerPostalCode,
        customerProvinceId: lead.customerProvinceId,
        // Combo: cada producto se vende en combos de 1/2/3 con precio propio.
        // quantity + productPrice (total del combo) deben ir juntos; el precio tiene
        // que coincidir con el catálogo de Latinecom (los precios de Shopify se
        // configuran para matchear ese catálogo).
        quantity: lead.quantity ?? 1,
        // Reconciliación con el postback + reporting.
        clickId: lead.id,
        subacc1: lead.id,
        subacc4: lead.channel,
        customFields: { source: "cpa-net", channel: lead.channel },
      };
      if (lead.totalPriceLocal != null) {
        body.productPrice = Number(lead.totalPriceLocal);
      }
      if (lead.customerEmail) body.customerEmail = lead.customerEmail;
      if (lead.customerFloor) body.customerFloor = lead.customerFloor;
      if (lead.customerApartment) body.customerApartment = lead.customerApartment;
      if (lead.customerBetweenStreets) body.customerBetweenStreets = lead.customerBetweenStreets;
      if (lead.customerShippingNotes) body.customerShippingNotes = lead.customerShippingNotes;
      if (env.LATINECOM_PUBLISHER_ID) body.publisherId = env.LATINECOM_PUBLISHER_ID;

      const url = `${env.LATINECOM_API_BASE_URL}/api/external/orders`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as EcomlatamCreateResponse;

      log.info(
        { leadId: lead.id, sku: offer.networkOfferId, phone: maskPhone(lead.customerPhone), httpStatus: res.status },
        "respuesta create",
      );

      // API key inválida: no reintentar contra el mismo error (surface del problema).
      if (res.status === 401 || res.status === 403) {
        return { ok: false, error: "Latinecom rechazó la API key (401/403)" };
      }

      if (res.ok) {
        // 200 no garantiza éxito: puede haber ido a papelera.
        const trashReason = detectTrash(data);
        if (trashReason) {
          return { ok: false, terminalStatus: "trash", note: trashReason.slice(0, 500) };
        }
        const networkLeadId = extractNetworkLeadId(data);
        if (networkLeadId) return { ok: true, networkLeadId };
        return { ok: false, error: "respuesta 2xx sin orderId/leadNumber ni marca de trash" };
      }

      // 4xx/5xx: error transitorio o de request → se reintenta.
      const errMsg =
        (typeof data.message === "string" && data.message) ||
        (typeof data.error === "string" && data.error) ||
        `HTTP ${res.status}`;
      return { ok: false, error: errMsg };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      log.error({ leadId: lead.id, error }, "createOrder falló");
      return { ok: false, error };
    }
  },

  // Latinecom empuja el estado por postback → no se pollea.
  async fetchStatuses(): Promise<NetworkStatusResult[]> {
    return [];
  },

  // Latinecom no expone catálogo: las ofertas se cargan a mano en /networks.
  async loadOffers(): Promise<NormalizedOffer[]> {
    return [];
  },
};
