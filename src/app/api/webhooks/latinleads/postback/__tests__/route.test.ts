import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    lead: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/notify", () => ({ sendAlert: vi.fn().mockResolvedValue(undefined) }));
const { capiMock } = vi.hoisted(() => ({ capiMock: vi.fn().mockResolvedValue({ ok: true }) }));
vi.mock("@/lib/meta/capi", () => ({
  sendPurchaseEvent: capiMock,
  isCapiConfigured: () => true,
}));

import { GET } from "@/app/api/webhooks/latinleads/postback/route";
import { mapPostbackStatus } from "@/lib/leads/postback-handler";

const TOKEN = "test-latinleads-token";

function makeReq(params: Record<string, string>): Request {
  const u = new URL("http://localhost/api/webhooks/latinleads/postback");
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return new Request(u, { method: "GET" });
}

// Latinleads no manda payout → el revenue cae al payoutUsd de la oferta.
const leadShopify = {
  id: "lead-1",
  status: "sent_to_network",
  networkLeadId: "IG-1",
  platform: "shopify",
  offer: { payoutUsd: 5, networkOfferId: "GOODS-1" },
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.lead.findFirst.mockResolvedValue(leadShopify);
  prismaMock.lead.findUnique.mockResolvedValue(null);
  prismaMock.lead.update.mockResolvedValue({ id: "lead-1" });
});

describe("mapPostbackStatus", () => {
  it("cubre el vocabulario de Latinleads y Latinecom", () => {
    expect(mapPostbackStatus("confirmed")).toBe("lead");
    expect(mapPostbackStatus("sale")).toBe("lead");
    expect(mapPostbackStatus("hold")).toBe("hold");
    expect(mapPostbackStatus("rejected")).toBe("reject");
    expect(mapPostbackStatus("trash")).toBe("trash");
    expect(mapPostbackStatus("loquesea")).toBe("unknown");
  });
});

describe("GET /api/webhooks/latinleads/postback", () => {
  it("confirmed => lead con revenue del payoutUsd de la oferta (sin payout en el postback)", async () => {
    const res = await GET(makeReq({ token: TOKEN, leadId: "IG-1", status: "confirmed" }));
    expect(res.status).toBe(200);
    const arg = prismaMock.lead.update.mock.calls[0]![0];
    expect(arg.data.status).toBe("lead");
    expect(arg.data.revenueUsd).toBe(5);
  });

  it("rejected => reject", async () => {
    await GET(makeReq({ token: TOKEN, leadId: "IG-1", status: "rejected" }));
    expect(prismaMock.lead.update.mock.calls[0]![0].data.status).toBe("reject");
  });

  it("rechaza 401 con token inválido", async () => {
    const res = await GET(makeReq({ token: "mal", leadId: "IG-1", status: "confirmed" }));
    expect(res.status).toBe(401);
    expect(prismaMock.lead.update).not.toHaveBeenCalled();
  });

  it("reconcilia por clickId (= lead.id) si no matchea el networkLeadId", async () => {
    prismaMock.lead.findFirst.mockResolvedValue(null);
    prismaMock.lead.findUnique.mockResolvedValue(leadShopify);
    await GET(makeReq({ token: TOKEN, clickId: "11111111-1111-1111-1111-111111111111", status: "hold" }));
    expect(prismaMock.lead.update.mock.calls[0]![0].data.status).toBe("hold");
  });

  it("clickId no-UUID (ej. data de un test) => lead_not_found, sin romper (no 500)", async () => {
    prismaMock.lead.findFirst.mockResolvedValue(null);
    const res = await GET(
      makeReq({ token: TOKEN, leadId: "999", status: "hold", clickId: "TEST-1783536387465-585" }),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ reason: "lead_not_found" });
    expect(prismaMock.lead.findUnique).not.toHaveBeenCalled();
  });

  it("CAPI se dispara en la aprobación para leads de Shopify (funnel Meta)", async () => {
    await GET(makeReq({ token: TOKEN, leadId: "IG-1", status: "confirmed" }));
    expect(capiMock).toHaveBeenCalledOnce();
  });

  it("CAPI NO se dispara para leads de otra plataforma (tráfico no-Meta)", async () => {
    prismaMock.lead.findFirst.mockResolvedValue({ ...leadShopify, platform: "estrategias" });
    await GET(makeReq({ token: TOKEN, leadId: "IG-1", status: "confirmed" }));
    expect(capiMock).not.toHaveBeenCalled();
  });
});
