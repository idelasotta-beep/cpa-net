import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/cron-auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Analítica de conversión de las landings propias: visitas (beacon) vs leads, por
 * landing, en una ventana de días. Sirve para el A/B contra Shopify+Releasit.
 * Protegido con Bearer CRON_SECRET. Query: ?days=14
 */
export async function GET(req: Request): Promise<Response> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sp = new URL(req.url).searchParams;
  const days = Math.min(90, Math.max(1, Number(sp.get("days")) || 14));
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (days - 1));

  const [visits, leads, approved] = await Promise.all([
    prisma.landingStat.groupBy({
      by: ["landingId"],
      where: { date: { gte: since } },
      _sum: { views: true, uniques: true },
    }),
    prisma.lead.groupBy({
      by: ["landingId"],
      where: { platform: "landing", landingId: { not: null }, createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.lead.groupBy({
      by: ["landingId"],
      where: { platform: "landing", landingId: { not: null }, status: "lead", createdAt: { gte: since } },
      _count: { _all: true },
    }),
  ]);

  // Merge por landingId.
  type Row = { landingId: string; views: number; uniques: number; leads: number; approved: number };
  const map = new Map<string, Row>();
  const row = (id: string): Row => {
    let r = map.get(id);
    if (!r) {
      r = { landingId: id, views: 0, uniques: 0, leads: 0, approved: 0 };
      map.set(id, r);
    }
    return r;
  };
  for (const v of visits) {
    const r = row(v.landingId);
    r.views = v._sum.views ?? 0;
    r.uniques = v._sum.uniques ?? 0;
  }
  for (const l of leads) if (l.landingId) row(l.landingId).leads = l._count._all;
  for (const a of approved) if (a.landingId) row(a.landingId).approved = a._count._all;

  const pct = (num: number, den: number): number | null => (den > 0 ? Math.round((num / den) * 1000) / 10 : null);

  const rows = [...map.values()]
    .map((r) => ({
      ...r,
      // Conversión sobre visitantes únicos (fallback a views si no hay únicos).
      conversionPct: pct(r.leads, r.uniques || r.views),
      approvalPct: pct(r.approved, r.leads),
    }))
    .sort((a, b) => b.leads - a.leads || b.uniques - a.uniques);

  const totals = rows.reduce(
    (t, r) => ({
      views: t.views + r.views,
      uniques: t.uniques + r.uniques,
      leads: t.leads + r.leads,
      approved: t.approved + r.approved,
    }),
    { views: 0, uniques: 0, leads: 0, approved: 0 },
  );

  return NextResponse.json({
    windowDays: days,
    since: since.toISOString().slice(0, 10),
    totals: {
      ...totals,
      conversionPct: pct(totals.leads, totals.uniques || totals.views),
      approvalPct: pct(totals.approved, totals.leads),
    },
    landings: rows,
  });
}
