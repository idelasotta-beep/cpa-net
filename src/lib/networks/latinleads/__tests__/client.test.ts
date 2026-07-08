import type { Lead, Offer } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { latinleadsClient, mapStatus } from "@/lib/networks/latinleads/client";

const lead = {
  id: "lead-uuid-123",
  customerName: "Juan Perez",
  customerPhone: "+56990001111",
} as unknown as Lead;

const offer = {
  networkOfferId: "1",
  country: "CL",
  priceLocal: 34500,
} as unknown as Offer;

function mockFetch(payload: unknown) {
  const fn = vi.fn().mockResolvedValue({ json: async () => payload });
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

afterEach(() => vi.restoreAllMocks());

describe("mapStatus (latinleads)", () => {
  it("traduce el vocabulario al canónico", () => {
    expect(mapStatus("confirm")).toBe("lead");
    expect(mapStatus("hold")).toBe("hold");
    expect(mapStatus("cancelled")).toBe("reject");
    expect(mapStatus("trash")).toBe("trash");
    expect(mapStatus("Dont Exist")).toBe("unknown");
  });
});

describe("latinleadsClient.createOrder", () => {
  it("happy path (is_valid=1): devuelve ext_id como networkLeadId", async () => {
    const fn = mockFetch({ status: "ok", ext_id: "3967506", is_valid: "1", is_duplicate: "0" });
    const res = await latinleadsClient.createOrder(lead, offer);
    expect(res).toMatchObject({ ok: true, networkLeadId: "3967506" });

    const url = String(fn.mock.calls[0]![0]);
    expect(url).toContain("/apiv2.php");
    expect(url).toContain("goods_id=1");
    expect(url).toContain(`order_id=${lead.id}`);
  });

  it("duplicado: rechazo terminal reject", async () => {
    mockFetch({ status: "ok", is_valid: "0", is_duplicate: "1" });
    const res = await latinleadsClient.createOrder(lead, offer);
    expect(res).toMatchObject({ ok: false, terminalStatus: "reject" });
  });

  it("teléfono inválido: rechazo terminal trash", async () => {
    mockFetch({ status: "ok", is_valid: "0", is_wrongtelephone: "1" });
    const res = await latinleadsClient.createOrder(lead, offer);
    expect(res).toMatchObject({ ok: false, terminalStatus: "trash", note: "wrong_telephone" });
  });

  it("tolera flags como número (la API a veces devuelve 1 en vez de '1')", async () => {
    mockFetch({ status: "ok", ext_id: "11588940", is_valid: 0, is_wrongtelephone: 1, is_duplicate: 0 });
    const res = await latinleadsClient.createOrder(lead, offer);
    expect(res).toMatchObject({ ok: false, terminalStatus: "trash", note: "wrong_telephone" });
  });

  it("server error: ok=false sin terminalStatus (reintenta)", async () => {
    mockFetch({ status: "error", error: "Server Error" });
    const res = await latinleadsClient.createOrder(lead, offer);
    expect(res.ok).toBe(false);
    expect(res.terminalStatus).toBeUndefined();
    expect(res.error).toContain("Server Error");
  });
});

describe("latinleadsClient.fetchStatuses", () => {
  it("mapea estados (sin revenue)", async () => {
    mockFetch([
      { order_id: 137951, status: "confirm" },
      { order_id: 135001, status: "cancelled" },
      { order_id: 9, status: "Dont Exist" },
    ]);
    const res = await latinleadsClient.fetchStatuses(["137951", "135001", "9"]);
    expect(res).toEqual([
      { networkLeadId: "137951", status: "lead", note: "confirm" },
      { networkLeadId: "135001", status: "reject", note: "cancelled" },
      { networkLeadId: "9", status: "unknown", note: "Dont Exist" },
    ]);
  });

  it("devuelve [] sin ids", async () => {
    const fn = mockFetch([]);
    const res = await latinleadsClient.fetchStatuses([]);
    expect(res).toEqual([]);
    expect(fn).not.toHaveBeenCalled();
  });
});
