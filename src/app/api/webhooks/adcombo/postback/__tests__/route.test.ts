import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    lead: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/notify", () => ({ sendAlert: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/meta/capi", () => ({
  sendPurchaseEvent: vi.fn().mockResolvedValue({ ok: true }),
  isCapiConfigured: () => false,
}));

import { GET } from "@/app/api/webhooks/adcombo/postback/route";

const TOKEN = "test-adcombo-token";

function makeReq(params: Record<string, string>): Request {
  const u = new URL("http://localhost/api/webhooks/adcombo/postback");
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return new Request(u, { method: "GET" });
}

const lead = {
  id: "lead-1",
  status: "sent_to_network",
  networkLeadId: "AC-500",
  platform: "estrategias",
  offer: { payoutUsd: 9, networkOfferId: "37167" },
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.lead.findFirst.mockResolvedValue(lead);
  prismaMock.lead.findUnique.mockResolvedValue(null);
  prismaMock.lead.update.mockResolvedValue({ id: "lead-1" });
});

describe("GET /api/webhooks/adcombo/postback", () => {
  it("lead => aprobado con revenue del payoutUsd de la oferta (si no manda payout)", async () => {
    const res = await GET(makeReq({ token: TOKEN, leadId: "AC-500", status: "lead" }));
    expect(res.status).toBe(200);
    const arg = prismaMock.lead.update.mock.calls[0]![0];
    expect(arg.data.status).toBe("lead");
    expect(arg.data.revenueUsd).toBe(9);
  });

  it("usa el payout del postback (USD) si viene", async () => {
    await GET(makeReq({ token: TOKEN, leadId: "AC-500", status: "lead", payout: "13.5" }));
    expect(prismaMock.lead.update.mock.calls[0]![0].data.revenueUsd).toBe(13.5);
  });

  it("hold => hold; rechaza 401 con token inválido", async () => {
    await GET(makeReq({ token: TOKEN, leadId: "AC-500", status: "hold" }));
    expect(prismaMock.lead.update.mock.calls[0]![0].data.status).toBe("hold");

    const bad = await GET(makeReq({ token: "mal", leadId: "AC-500", status: "hold" }));
    expect(bad.status).toBe(401);
  });
});
