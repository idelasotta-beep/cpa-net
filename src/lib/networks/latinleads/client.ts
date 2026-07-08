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
import type {
  LatinleadsCreateResponse,
  LatinleadsStatusItem,
} from "./latinleads.types";

const log = logger.child({ network: "latinleads" });

/** Traduce el status de Latinleads al canónico. */
export function mapStatus(status: string): CanonicalStatus | "unknown" {
  switch (status.trim().toLowerCase()) {
    case "confirm":
      return "lead";
    case "hold":
      return "hold";
    case "cancelled":
      return "reject";
    case "trash":
      return "trash";
    default:
      return "unknown"; // "dont exist" u otros
  }
}

function requireApiKey(): string {
  if (!env.LATINLEADS_API_KEY) {
    throw new Error("LATINLEADS_API_KEY no está configurada");
  }
  return env.LATINLEADS_API_KEY;
}

/** La API devuelve los flags como "1"/"0" o 1/0 → comparación tolerante. */
function flagOn(v: string | number | undefined): boolean {
  return String(v) === "1";
}

export const latinleadsClient: OfferNetworkClient = {
  slug: "latinleads",

  async createOrder(lead: Lead, offer: Offer): Promise<CreateOrderResult> {
    try {
      const apiKey = requireApiKey();
      const params = new URLSearchParams({
        order_id: lead.id,
        name: lead.customerName,
        phone: lead.customerPhone,
        api_key: apiKey,
        goods_id: offer.networkOfferId,
      });
      if (env.LATINLEADS_PUBLISHER_ID) {
        params.set("publisherId", env.LATINLEADS_PUBLISHER_ID);
      }

      const url = `${env.LATINLEADS_API_BASE_URL}/apiv2.php?${params.toString()}`;
      const res = await fetch(url, { method: "GET" });
      const data = (await res.json()) as LatinleadsCreateResponse;

      log.info(
        { leadId: lead.id, phone: maskPhone(lead.customerPhone), status: data.status, isValid: data.is_valid },
        "respuesta create",
      );

      if (data.status !== "ok") {
        // Error de servidor / transitorio → reintentar.
        return { ok: false, error: data.error || "server error" };
      }

      if (flagOn(data.is_valid) && data.ext_id != null) {
        return { ok: true, networkLeadId: String(data.ext_id) };
      }

      // Rechazo terminal: no reintentar.
      if (flagOn(data.is_duplicate)) {
        return { ok: false, terminalStatus: "reject", note: "duplicate" };
      }
      if (flagOn(data.is_blacklist)) {
        return { ok: false, terminalStatus: "trash", note: "blacklist" };
      }
      if (flagOn(data.is_wrongtelephone)) {
        return { ok: false, terminalStatus: "trash", note: "wrong_telephone" };
      }
      return { ok: false, terminalStatus: "trash", note: "rejected (is_valid=0)" };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      log.error({ leadId: lead.id, error }, "createOrder falló");
      return { ok: false, error };
    }
  },

  async fetchStatuses(networkLeadIds: string[]): Promise<NetworkStatusResult[]> {
    if (networkLeadIds.length === 0) return [];
    const apiKey = requireApiKey();
    const ids = networkLeadIds.slice(0, 200).join(",");
    const url = `${env.LATINLEADS_API_BASE_URL}/status.php?ids=${encodeURIComponent(ids)}&api_key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, { method: "GET" });
    const data = (await res.json()) as LatinleadsStatusItem[];

    return (Array.isArray(data) ? data : []).map((item) => ({
      networkLeadId: String(item.order_id),
      status: mapStatus(item.status),
      // Latinleads no devuelve revenue; el poll usa el payoutUsd de la oferta.
      note: item.status,
    }));
  },

  // Latinleads no expone catálogo de ofertas: se cargan a mano.
  async loadOffers(): Promise<NormalizedOffer[]> {
    return [];
  },
};
