import type { Lead, Offer } from "@prisma/client";
import { env } from "@/lib/env";
import { generateIpForCountry } from "@/lib/geo-ip";
import { logger, maskPhone } from "@/lib/logger";
import type {
  CanonicalStatus,
  CreateOrderResult,
  NetworkStatusResult,
  NormalizedOffer,
  OfferNetworkClient,
} from "../types";
import type {
  AdcomboCreateResponse,
  AdcomboOfferInfoResponse,
  AdcomboStatusResponse,
} from "./adcombo.types";

const log = logger.child({ network: "adcombo" });

/** Traduce el status de Adcombo al canónico. "unknown" => no tocar el estado local. */
export function mapStatus(status: string): CanonicalStatus | "unknown" {
  switch (status.trim().toLowerCase()) {
    case "hold":
      return "hold";
    case "confirmed":
      return "lead";
    case "cancelled":
      return "reject";
    case "trash":
      return "trash";
    default:
      return "unknown";
  }
}

function requireApiKey(): string {
  if (!env.ADCOMBO_API_KEY) {
    throw new Error("ADCOMBO_API_KEY no está configurada");
  }
  return env.ADCOMBO_API_KEY;
}

export const adcomboClient: OfferNetworkClient = {
  slug: "adcombo",

  async createOrder(lead: Lead, offer: Offer): Promise<CreateOrderResult> {
    try {
      const apiKey = requireApiKey();
      const ip = generateIpForCountry(offer.country, lead.id);

      const params = new URLSearchParams({
        api_key: apiKey,
        offer_id: offer.networkOfferId,
        name: lead.customerName,
        phone: lead.customerPhone,
        country_code: offer.country,
        price: offer.priceLocal.toString(),
        ip,
        ext_in_id: lead.id,
        subacc: lead.id, // clave de reconciliación
        subacc4: lead.source,
      });
      if (lead.utmCampaign) params.set("subacc2", lead.utmCampaign);
      if (lead.utmContent) params.set("subacc3", lead.utmContent);
      if (lead.utmSource) params.set("utm_source", lead.utmSource);
      if (lead.utmCampaign) params.set("utm_campaign", lead.utmCampaign);
      if (lead.utmContent) params.set("utm_content", lead.utmContent);
      if (lead.utmTerm) params.set("utm_term", lead.utmTerm);
      if (env.ADCOMBO_DEFAULT_BASE_URL) params.set("base_url", env.ADCOMBO_DEFAULT_BASE_URL);
      if (env.ADCOMBO_DEFAULT_REFERRER) params.set("referrer", env.ADCOMBO_DEFAULT_REFERRER);

      const url = `${env.ADCOMBO_API_BASE_URL}/order/create/?${params.toString()}`;
      const res = await fetch(url, { method: "GET" });
      const data = (await res.json()) as AdcomboCreateResponse;

      log.info(
        { leadId: lead.id, offerId: offer.networkOfferId, phone: maskPhone(lead.customerPhone), code: data.code },
        "respuesta create",
      );

      if (data.code === "ok" && data.order_id != null) {
        return {
          ok: true,
          networkLeadId: String(data.order_id),
          isDouble: Boolean(data.is_double),
        };
      }
      return { ok: false, error: data.error || data.msg || "respuesta no-ok" };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      log.error({ leadId: lead.id, error }, "createOrder falló");
      return { ok: false, error };
    }
  },

  async fetchStatuses(networkLeadIds: string[]): Promise<NetworkStatusResult[]> {
    if (networkLeadIds.length === 0) return [];
    const apiKey = requireApiKey();
    const params = new URLSearchParams({
      api_key: apiKey,
      orders: networkLeadIds.slice(0, 500).join(","),
      currency_code: "USD",
    });
    const url = `${env.ADCOMBO_API_BASE_URL}/order/status/?${params.toString()}`;
    const res = await fetch(url, { method: "GET" });
    const data = (await res.json()) as AdcomboStatusResponse;

    return (data.data ?? []).map((item) => {
      const status = mapStatus(item.status);
      const revenueUsd =
        status === "lead" && item.price != null ? Number(item.price) : undefined;
      const note = [item.status, item.extra_state, item.comment]
        .filter(Boolean)
        .join(" | ");
      return {
        networkLeadId: String(item.order_id),
        status,
        revenueUsd,
        note,
      };
    });
  },

  async loadOffers(): Promise<NormalizedOffer[]> {
    const apiKey = requireApiKey();
    const out: NormalizedOffer[] = [];
    let page = 1;
    let total = Infinity;
    const perPage = 100;

    while (out.length < total && page <= 50) {
      const url = `${env.ADCOMBO_OFFER_INFO_URL}?api_key=${apiKey}&per_page=${perPage}&page=${page}`;
      const res = await fetch(url, { method: "GET" });
      const data = (await res.json()) as AdcomboOfferInfoResponse;
      total = data.total ?? out.length;
      for (const o of data.offers ?? []) {
        const country = (o.countries ?? "").split(",")[0]?.trim() ?? "";
        const payoutUsd = o.payout?.[0]?.amount ?? 0;
        const priceLocal = o.total_price?.default?.[0]?.price_raw ?? 0;
        out.push({
          networkOfferId: String(o.id),
          name: o.name,
          country,
          payoutUsd,
          priceLocal,
        });
      }
      if (!data.offers || data.offers.length === 0) break;
      page++;
    }
    log.info({ count: out.length }, "loadOffers completado");
    return out;
  },
};
