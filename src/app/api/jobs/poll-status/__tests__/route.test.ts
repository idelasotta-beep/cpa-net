import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, clientMock } = vi.hoisted(() => ({
  prismaMock: { lead: { findMany: vi.fn(), update: vi.fn() } },
  clientMock: { slug: "adcombo", createOrder: vi.fn(), fetchStatuses: vi.fn(), loadOffers: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/networks/registry", () => ({ getNetworkClient: () => clientMock }));

import { GET } from "@/app/api/jobs/poll-status/route";

function leadFixture(over: Record<string, unknown> = {}) {
  return {
    id: "lead-1",
    status: "sent_to_network",
    networkLeadId: "77",
    offer: { network: { slug: "adcombo", active: true } },
    ...over,
  };
}

function req() {
  return new Request("http://localhost/api/jobs/poll-status", {
    headers: { authorization: "Bearer test-cron-secret" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.lead.update.mockResolvedValue({});
});

describe("GET /api/jobs/poll-status", () => {
  it("401 sin Bearer válido", async () => {
    const res = await GET(new Request("http://localhost/api/jobs/poll-status"));
    expect(res.status).toBe(401);
  });

  it("actualiza a lead y setea revenue cuando Adcombo confirma", async () => {
    prismaMock.lead.findMany.mockResolvedValue([leadFixture()]);
    clientMock.fetchStatuses.mockResolvedValue([
      { networkLeadId: "77", status: "lead", revenueUsd: 16, note: "confirmed" },
    ]);

    const res = await GET(req());
    await expect(res.json()).resolves.toMatchObject({ checked: 1, updated: 1 });

    const data = prismaMock.lead.update.mock.calls[0]![0].data;
    expect(data).toMatchObject({ status: "lead", revenueUsd: 16 });
  });

  it("no actualiza si el status no cambió", async () => {
    prismaMock.lead.findMany.mockResolvedValue([leadFixture({ status: "hold" })]);
    clientMock.fetchStatuses.mockResolvedValue([
      { networkLeadId: "77", status: "hold" },
    ]);

    const res = await GET(req());
    await expect(res.json()).resolves.toMatchObject({ updated: 0 });
    expect(prismaMock.lead.update).not.toHaveBeenCalled();
  });

  it("ignora status unknown (no toca el lead)", async () => {
    prismaMock.lead.findMany.mockResolvedValue([leadFixture()]);
    clientMock.fetchStatuses.mockResolvedValue([
      { networkLeadId: "77", status: "unknown" },
    ]);

    await GET(req());
    expect(prismaMock.lead.update).not.toHaveBeenCalled();
  });
});
