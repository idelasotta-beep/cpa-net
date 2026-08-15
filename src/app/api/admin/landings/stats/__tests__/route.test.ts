import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    landingStat: { groupBy: vi.fn() },
    lead: { groupBy: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/cron-auth", () => ({ isAuthorized: (req: Request) => req.headers.get("authorization") === "Bearer secret" }));

import { GET } from "@/app/api/admin/landings/stats/route";

function makeReq(url = "http://localhost/api/admin/landings/stats", auth = true): Request {
  return new Request(url, { headers: auth ? { authorization: "Bearer secret" } : {} });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/admin/landings/stats", () => {
  it("sin auth => 401", async () => {
    const res = await GET(makeReq(undefined, false));
    expect(res.status).toBe(401);
  });

  it("mergea visitas + leads y calcula conversión", async () => {
    prismaMock.landingStat.groupBy.mockResolvedValue([
      { landingId: "es-linterna-1", _sum: { views: 200, uniques: 100 } },
    ]);
    // Primera llamada a lead.groupBy = leads totales; segunda = aprobados (status lead).
    prismaMock.lead.groupBy
      .mockResolvedValueOnce([{ landingId: "es-linterna-1", _count: { _all: 10 } }])
      .mockResolvedValueOnce([{ landingId: "es-linterna-1", _count: { _all: 4 } }]);

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    const row = body.landings[0];
    expect(row).toMatchObject({ landingId: "es-linterna-1", views: 200, uniques: 100, leads: 10, approved: 4 });
    expect(row.conversionPct).toBe(10); // 10/100
    expect(row.approvalPct).toBe(40); // 4/10
    expect(body.totals).toMatchObject({ views: 200, uniques: 100, leads: 10, approved: 4, conversionPct: 10 });
  });

  it("landing con visitas y sin leads => conversión 0%", async () => {
    prismaMock.landingStat.groupBy.mockResolvedValue([
      { landingId: "es-x-2", _sum: { views: 50, uniques: 40 } },
    ]);
    prismaMock.lead.groupBy.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const res = await GET(makeReq());
    const body = await res.json();
    expect(body.landings[0].conversionPct).toBe(0);
    expect(body.landings[0].approvalPct).toBeNull(); // 0 leads → null
  });
});
