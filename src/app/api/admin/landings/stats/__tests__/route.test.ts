import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    landingStat: { findMany: vi.fn() },
    lead: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/cron-auth", () => ({
  isAuthorized: (req: Request) => req.headers.get("authorization") === "Bearer secret",
}));

import { GET } from "@/app/api/admin/landings/stats/route";

function makeReq(qs = "", auth = true): Request {
  return new Request(`http://localhost/api/admin/landings/stats${qs}`, {
    headers: auth ? { authorization: "Bearer secret" } : {},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.landingStat.findMany.mockResolvedValue([]);
  prismaMock.lead.findMany.mockResolvedValue([]);
});

describe("GET /api/admin/landings/stats", () => {
  it("sin auth => 401", async () => {
    const res = await GET(makeReq("", false));
    expect(res.status).toBe(401);
  });

  it("embudo separado: landing (visita→abrió) y form (abrió→lead)", async () => {
    prismaMock.landingStat.findMany.mockResolvedValue([
      { landingId: "es-linterna-1", date: new Date("2026-08-14T00:00:00Z"), views: 200, uniques: 100, starts: 40 },
    ]);
    prismaMock.lead.findMany.mockResolvedValue([
      ...Array.from({ length: 9 }, () => ({ landingId: "es-linterna-1", createdAt: new Date("2026-08-14T10:00:00Z"), status: "hold" })),
      { landingId: "es-linterna-1", createdAt: new Date("2026-08-14T11:00:00Z"), status: "lead" },
    ]);

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    const r = body.landings[0];
    expect(r).toMatchObject({ views: 200, uniques: 100, starts: 40, leads: 10, approved: 1 });
    expect(r.landingConvPct).toBe(40); // 40/100 abrieron el form
    expect(r.formConvPct).toBe(25); // 10/40 de los que abrieron enviaron
    expect(r.conversionPct).toBe(10); // 10/100 global
    expect(r.approvalPct).toBe(10); // 1/10 aprobados
    expect(body.totals).toMatchObject({ leads: 10, starts: 40, formConvPct: 25 });
  });

  it("filtro from/to define la ventana y la refleja en la respuesta", async () => {
    await GET(makeReq("?from=2026-08-01&to=2026-08-07"));
    const where = prismaMock.landingStat.findMany.mock.calls[0]![0].where;
    expect(where.date.gte.toISOString().slice(0, 10)).toBe("2026-08-01");
    // lt exclusivo = día siguiente a `to`.
    expect(where.date.lt.toISOString().slice(0, 10)).toBe("2026-08-08");
    const body = await (await GET(makeReq("?from=2026-08-01&to=2026-08-07"))).json();
    expect(body).toMatchObject({ from: "2026-08-01", to: "2026-08-07" });
  });

  it("filtro por landingId se aplica al where de ambas tablas", async () => {
    await GET(makeReq("?landingId=es-x-2"));
    expect(prismaMock.landingStat.findMany.mock.calls[0]![0].where.landingId).toBe("es-x-2");
    expect(prismaMock.lead.findMany.mock.calls[0]![0].where.landingId).toBe("es-x-2");
  });

  it("series=1 devuelve buckets diarios continuos", async () => {
    prismaMock.landingStat.findMany.mockResolvedValue([
      { landingId: "es-a", date: new Date("2026-08-13T00:00:00Z"), views: 10, uniques: 8, starts: 3 },
    ]);
    const body = await (await GET(makeReq("?from=2026-08-13&to=2026-08-15&series=1"))).json();
    expect(Array.isArray(body.series)).toBe(true);
    expect(body.series.map((d: { date: string }) => d.date)).toEqual(["2026-08-13", "2026-08-14", "2026-08-15"]);
    expect(body.series[0]).toMatchObject({ date: "2026-08-13", views: 10, uniques: 8, starts: 3 });
  });
});
