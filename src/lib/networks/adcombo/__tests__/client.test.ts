import type { Lead, Offer } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { adcomboClient, mapStatus } from "@/lib/networks/adcombo/client";

const lead = {
  id: "lead-uuid-123",
  customerName: "Juan Perez",
  customerPhone: "+56990001111",
  customerAddress: "Av Siempre Viva 742",
  customerCity: "Santiago",
  customerRegion: "RM",
  source: "shopify",
  utmSource: "fb",
  utmCampaign: "camp1",
  utmContent: "ad1",
  utmTerm: null,
} as unknown as Lead;

const offer = {
  networkOfferId: "37167",
  country: "CL",
  priceLocal: 34500,
} as unknown as Offer;

function mockFetch(payload: unknown) {
  const fn = vi.fn().mockResolvedValue({ json: async () => payload });
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

afterEach(() => vi.restoreAllMocks());

describe("mapStatus", () => {
  it("traduce el vocabulario de Adcombo al canónico", () => {
    expect(mapStatus("hold")).toBe("hold");
    expect(mapStatus("confirmed")).toBe("lead");
    expect(mapStatus("cancelled")).toBe("reject");
    expect(mapStatus("trash")).toBe("trash");
    expect(mapStatus("unknown")).toBe("unknown");
    expect(mapStatus("loquesea")).toBe("unknown");
  });
});

describe("adcomboClient.createOrder", () => {
  it("happy path: arma los params y devuelve networkLeadId", async () => {
    const fn = mockFetch({ code: "ok", order_id: 12345, is_double: false });
    const res = await adcomboClient.createOrder(lead, offer);
    expect(res).toMatchObject({ ok: true, networkLeadId: "12345", isDouble: false });

    const url = String(fn.mock.calls[0]![0]);
    expect(url).toContain("/order/create/");
    expect(url).toContain("offer_id=37167");
    expect(url).toContain("country_code=CL");
    expect(url).toContain("price=34500");
    expect(url).toContain(`subacc=${lead.id}`);
    expect(url).toContain(`ext_in_id=${lead.id}`);
    expect(url).toMatch(/[?&]ip=\d+\.\d+\.\d+\.\d+/);
    // address combina dirección + ciudad + región
    expect(new URL(url).searchParams.get("address")).toBe("Av Siempre Viva 742, Santiago, RM");
  });

  it("marca is_double cuando Adcombo lo reporta", async () => {
    mockFetch({ code: "ok", order_id: 999, is_double: true });
    const res = await adcomboClient.createOrder(lead, offer);
    expect(res).toMatchObject({ ok: true, networkLeadId: "999", isDouble: true });
  });

  it("devuelve ok=false ante code=error", async () => {
    mockFetch({ code: "error", error: 'Missing required param: "name"' });
    const res = await adcomboClient.createOrder(lead, offer);
    expect(res.ok).toBe(false);
    expect(res.error).toContain("Missing required param");
  });
});

describe("adcomboClient.fetchStatuses", () => {
  it("mapea estados y revenue (solo confirmed trae revenue)", async () => {
    mockFetch({
      code: "ok",
      data: [
        { order_id: 1, status: "confirmed", price: "9.50" },
        { order_id: 2, status: "hold" },
        { order_id: 3, status: "cancelled" },
        { order_id: 4, status: "trash" },
        { order_id: 5, status: "weird" },
      ],
    });
    const res = await adcomboClient.fetchStatuses(["1", "2", "3", "4", "5"]);
    expect(res).toEqual([
      { networkLeadId: "1", status: "lead", revenueUsd: 9.5, note: "confirmed" },
      { networkLeadId: "2", status: "hold", revenueUsd: undefined, note: "hold" },
      { networkLeadId: "3", status: "reject", revenueUsd: undefined, note: "cancelled" },
      { networkLeadId: "4", status: "trash", revenueUsd: undefined, note: "trash" },
      { networkLeadId: "5", status: "unknown", revenueUsd: undefined, note: "weird" },
    ]);
  });

  it("devuelve [] sin ids", async () => {
    const fn = mockFetch({ code: "ok", data: [] });
    const res = await adcomboClient.fetchStatuses([]);
    expect(res).toEqual([]);
    expect(fn).not.toHaveBeenCalled();
  });
});
