import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, clientMock } = vi.hoisted(() => ({
  prismaMock: { lead: { findMany: vi.fn(), update: vi.fn() } },
  clientMock: { slug: "adcombo", createOrder: vi.fn(), fetchStatuses: vi.fn(), loadOffers: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/networks/registry", () => ({ getNetworkClient: () => clientMock }));

import { GET } from "@/app/api/jobs/push-pending/route";

function leadFixture(over: Record<string, unknown> = {}) {
  return {
    id: "lead-1",
    status: "pending",
    pushAttempts: 0,
    customerName: "Juan",
    customerPhone: "+56990001111",
    source: "shopify",
    utmCampaign: null,
    utmContent: null,
    utmSource: null,
    utmTerm: null,
    offer: {
      networkOfferId: "37167",
      country: "CL",
      priceLocal: 34500,
      network: { slug: "adcombo", active: true },
    },
    ...over,
  };
}

function req() {
  return new Request("http://localhost/api/jobs/push-pending", {
    headers: { authorization: "Bearer test-cron-secret" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.lead.update.mockResolvedValue({});
});

describe("GET /api/jobs/push-pending", () => {
  it("401 sin Bearer válido", async () => {
    const res = await GET(new Request("http://localhost/api/jobs/push-pending"));
    expect(res.status).toBe(401);
    expect(prismaMock.lead.findMany).not.toHaveBeenCalled();
  });

  it("happy: envía el lead y lo marca sent_to_network", async () => {
    prismaMock.lead.findMany.mockResolvedValue([leadFixture()]);
    clientMock.createOrder.mockResolvedValue({ ok: true, networkLeadId: "77", isDouble: false });

    const res = await GET(req());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ processed: 1, ok: 1, failed: 0 });

    const data = prismaMock.lead.update.mock.calls[0]![0].data;
    expect(data).toMatchObject({ status: "sent_to_network", networkLeadId: "77", pushAttempts: 1 });
  });

  it("error en el último intento => status failed", async () => {
    prismaMock.lead.findMany.mockResolvedValue([leadFixture({ pushAttempts: 4 })]);
    clientMock.createOrder.mockResolvedValue({ ok: false, error: "boom" });

    const res = await GET(req());
    await expect(res.json()).resolves.toMatchObject({ processed: 1, ok: 0, failed: 1 });

    const data = prismaMock.lead.update.mock.calls[0]![0].data;
    expect(data).toMatchObject({ status: "failed", pushAttempts: 5, lastPushError: "boom" });
  });

  it("error transitorio (no último) => solo incrementa intentos", async () => {
    prismaMock.lead.findMany.mockResolvedValue([leadFixture({ pushAttempts: 1 })]);
    clientMock.createOrder.mockResolvedValue({ ok: false, error: "timeout" });

    await GET(req());
    const data = prismaMock.lead.update.mock.calls[0]![0].data;
    expect(data.pushAttempts).toBe(2);
    expect(data.status).toBeUndefined();
  });
});
