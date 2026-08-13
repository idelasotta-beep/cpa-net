import type { Lead, Offer } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { detectTrash, latinecomClient, mapStatus } from "@/lib/networks/latinecom/client";

const lead = {
  id: "lead-uuid-123",
  channel: "shopify",
  customerName: "Prueba Test",
  customerPhone: "5493814572504",
  customerEmail: "cliente@example.com",
  customerStreet: "Ramón Cruz Montt",
  customerStreetNumber: "2137",
  customerCity: "Campo Rigonato",
  customerPostalCode: "3606",
  customerProvinceId: 9,
  customerFloor: "Piso 3",
  customerApartment: null,
  customerBetweenStreets: "entre X e Y",
  customerShippingNotes: null,
  quantity: 2,
  totalPriceLocal: 39990,
} as unknown as Lead;

const offer = {
  networkOfferId: "SKU-P90",
  country: "AR",
  priceLocal: 21990,
} as unknown as Offer;

function mockFetch(payload: unknown, init: { ok?: boolean; status?: number } = {}) {
  const fn = vi.fn().mockResolvedValue({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => payload,
  });
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

afterEach(() => vi.restoreAllMocks());

describe("mapStatus (postback)", () => {
  it("traduce los outcomes de Latinecom al canónico", () => {
    expect(mapStatus("sale")).toBe("lead");
    expect(mapStatus("Sales")).toBe("lead");
    expect(mapStatus("hold")).toBe("hold");
    expect(mapStatus("rejected")).toBe("reject");
    expect(mapStatus("trash")).toBe("trash");
    expect(mapStatus("loquesea")).toBe("unknown");
  });
});

describe("detectTrash", () => {
  it("detecta las distintas marcas de papelera en un 200", () => {
    expect(detectTrash({ message: "DUPLICATE - already submitted" })).toBeTruthy();
    expect(detectTrash({ message: "Validation failed" })).toBeTruthy();
    expect(detectTrash({ status: "trash" })).toBeTruthy();
    expect(detectTrash({ autoTrash: true })).toBeTruthy();
    expect(detectTrash({ validationErrors: { phone: "invalid" } })).toBeTruthy();
    expect(detectTrash({ lead: { status: "trash" } })).toBeTruthy();
  });

  it("no marca trash un éxito real", () => {
    expect(detectTrash({ orderId: 123, status: "hold" })).toBeNull();
    expect(detectTrash({ leadNumber: "SHOPIFY-x-1001" })).toBeNull();
  });
});

describe("latinecomClient.createOrder", () => {
  it("happy path: arma el body y devuelve networkLeadId", async () => {
    const fn = mockFetch({ orderId: 456789 });
    const res = await latinecomClient.createOrder(lead, offer);
    expect(res).toEqual({ ok: true, networkLeadId: "456789" });

    const [url, opts] = fn.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("https://latinecom.com/api/external/orders");
    expect((opts.headers as Record<string, string>)["X-API-Key"]).toBe("test-latinecom-key");
    const body = JSON.parse(opts.body as string);
    expect(body).toMatchObject({
      productSku: "SKU-P90",
      customerName: "Prueba Test",
      customerPhone: "5493814572504",
      customerStreet: "Ramón Cruz Montt",
      customerStreetNumber: "2137",
      customerProvinceId: 9,
      clickId: "lead-uuid-123",
      subacc1: "lead-uuid-123",
      subacc4: "shopify",
      quantity: 2, // cantidad real del combo, no fija en 1
      productPrice: 39990, // total del combo
    });
  });

  it("acepta leadNumber como networkLeadId", async () => {
    mockFetch({ leadNumber: "SHOPIFY-tienda-1003" });
    const res = await latinecomClient.createOrder(lead, offer);
    expect(res).toEqual({ ok: true, networkLeadId: "SHOPIFY-tienda-1003" });
  });

  it("sin llamar a la API: falta provincia => terminalStatus trash", async () => {
    const fn = mockFetch({ orderId: 1 });
    const leadSinProvincia = { ...lead, customerProvinceId: null } as unknown as Lead;
    const res = await latinecomClient.createOrder(leadSinProvincia, offer);
    expect(res.ok).toBe(false);
    expect(res.terminalStatus).toBe("trash");
    expect(res.note).toContain("provinceId");
    expect(fn).not.toHaveBeenCalled();
  });

  it("trash-en-200 (duplicado) => terminalStatus trash", async () => {
    mockFetch({ message: "Lead created but product item association failed" });
    const res = await latinecomClient.createOrder(lead, offer);
    expect(res.ok).toBe(false);
    expect(res.terminalStatus).toBe("trash");
  });

  it("2xx sin orderId ni marca de trash => error (reintenta)", async () => {
    mockFetch({ foo: "bar" });
    const res = await latinecomClient.createOrder(lead, offer);
    expect(res.ok).toBe(false);
    expect(res.terminalStatus).toBeUndefined();
    expect(res.error).toBeTruthy();
  });

  it("401 => error de API key (no terminal)", async () => {
    mockFetch({ error: "unauthorized" }, { ok: false, status: 401 });
    const res = await latinecomClient.createOrder(lead, offer);
    expect(res.ok).toBe(false);
    expect(res.terminalStatus).toBeUndefined();
    expect(res.error).toContain("API key");
  });

  it("5xx => error transitorio (reintenta)", async () => {
    mockFetch({ message: "server error" }, { ok: false, status: 502 });
    const res = await latinecomClient.createOrder(lead, offer);
    expect(res).toEqual({ ok: false, error: "server error" });
  });
});

describe("latinecomClient postback-only", () => {
  it("fetchStatuses y loadOffers devuelven [] (Latinecom empuja por postback)", async () => {
    expect(await latinecomClient.fetchStatuses(["x"])).toEqual([]);
    expect(await latinecomClient.loadOffers()).toEqual([]);
  });
});
