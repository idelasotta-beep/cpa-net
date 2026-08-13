import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    lead: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/notify", () => ({ sendAlert: vi.fn().mockResolvedValue(undefined) }));

import { GET } from "@/app/api/webhooks/ecomlatam/postback/route";

const TOKEN = "test-postback-token";

function makeReq(params: Record<string, string>): Request {
  const u = new URL("http://localhost/api/webhooks/ecomlatam/postback");
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return new Request(u, { method: "GET" });
}

const leadSent = {
  id: "lead-uuid-1",
  status: "sent_to_network",
  networkLeadId: "EC-999",
  offer: { payoutUsd: 12 },
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.lead.findFirst.mockResolvedValue(leadSent);
  prismaMock.lead.findUnique.mockResolvedValue(null);
  prismaMock.lead.update.mockResolvedValue({ id: "lead-uuid-1" });
});

describe("GET /api/webhooks/ecomlatam/postback", () => {
  it("Sales: actualiza a lead con revenue del payout (USD)", async () => {
    const res = await GET(
      makeReq({ token: TOKEN, leadId: "EC-999", status: "sale", payout: "14.5" }),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      status: "updated",
      new_status: "lead",
    });
    const arg = prismaMock.lead.update.mock.calls[0]![0];
    expect(arg.data.status).toBe("lead");
    expect(arg.data.revenueUsd).toBe(14.5);
  });

  it("Sales sin payout: cae al payoutUsd de la oferta", async () => {
    await GET(makeReq({ token: TOKEN, leadId: "EC-999", status: "sale" }));
    const arg = prismaMock.lead.update.mock.calls[0]![0];
    expect(arg.data.revenueUsd).toBe(12);
  });

  it("rechaza 401 con token inválido", async () => {
    const res = await GET(makeReq({ token: "mal", leadId: "EC-999", status: "sale" }));
    expect(res.status).toBe(401);
    expect(prismaMock.lead.update).not.toHaveBeenCalled();
  });

  it("status desconocido: ignora sin tocar la DB", async () => {
    const res = await GET(makeReq({ token: TOKEN, leadId: "EC-999", status: "loquesea" }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ reason: "unknown_status" });
    expect(prismaMock.lead.update).not.toHaveBeenCalled();
  });

  it("lead no encontrado: ignora", async () => {
    prismaMock.lead.findFirst.mockResolvedValue(null);
    const res = await GET(makeReq({ token: TOKEN, leadId: "NOPE", status: "hold" }));
    await expect(res.json()).resolves.toMatchObject({ reason: "lead_not_found" });
    expect(prismaMock.lead.update).not.toHaveBeenCalled();
  });

  it("idempotente: si el estado no cambia, no actualiza", async () => {
    prismaMock.lead.findFirst.mockResolvedValue({ ...leadSent, status: "hold" });
    const res = await GET(makeReq({ token: TOKEN, leadId: "EC-999", status: "hold" }));
    await expect(res.json()).resolves.toMatchObject({ status: "unchanged" });
    expect(prismaMock.lead.update).not.toHaveBeenCalled();
  });

  it("reconcilia por clickId (= lead.id) si no matchea el networkLeadId", async () => {
    prismaMock.lead.findFirst.mockResolvedValue(null);
    prismaMock.lead.findUnique.mockResolvedValue(leadSent);
    const res = await GET(
      makeReq({ token: TOKEN, clickId: "lead-uuid-1", status: "rejected" }),
    );
    expect(res.status).toBe(200);
    const arg = prismaMock.lead.update.mock.calls[0]![0];
    expect(arg.data.status).toBe("reject");
    expect(prismaMock.lead.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "lead-uuid-1" } }),
    );
  });
});
