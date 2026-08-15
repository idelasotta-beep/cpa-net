import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/cron-auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/** yyyy-mm-dd (UTC) de una fecha. */
function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Parsea yyyy-mm-dd a medianoche UTC, o null si no es válido. */
function parseDay(v: string | null): Date | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

const pct = (num: number, den: number): number | null =>
  den > 0 ? Math.round((num / den) * 1000) / 10 : null;

/**
 * Analítica de conversión de las landings propias. Embudo: visita → form abierto →
 * lead → aprobado. Protegido con Bearer CRON_SECRET.
 * Query: ?days=14 | ?from=YYYY-MM-DD&to=YYYY-MM-DD | ?landingId=... | ?series=1
 */
export async function GET(req: Request): Promise<Response> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sp = new URL(req.url).searchParams;
  const landingId = sp.get("landingId")?.trim() || null;
  const withSeries = sp.get("series") === "1" || sp.get("series") === "true";

  // Ventana: from/to tienen prioridad; si no, últimos `days` días.
  const days = Math.min(365, Math.max(1, Number(sp.get("days")) || 14));
  const from = parseDay(sp.get("from"));
  const to = parseDay(sp.get("to"));
  const todayMidnight = new Date();
  todayMidnight.setUTCHours(0, 0, 0, 0);

  const since = from ?? new Date(todayMidnight.getTime() - (days - 1) * 86_400_000);
  // Límite superior exclusivo: día siguiente a `to`, o mañana (incluye hoy) si no hay `to`.
  const until = to ? new Date(to.getTime() + 86_400_000) : new Date(todayMidnight.getTime() + 86_400_000);

  const statWhere: Prisma.LandingStatWhereInput = {
    date: { gte: since, lt: until },
    ...(landingId ? { landingId } : {}),
  };
  const leadWhere: Prisma.LeadWhereInput = {
    platform: "landing",
    landingId: landingId ? landingId : { not: null },
    createdAt: { gte: since, lt: until },
  };

  const [statRows, leadRows] = await Promise.all([
    prisma.landingStat.findMany({
      where: statWhere,
      select: { landingId: true, date: true, views: true, uniques: true, starts: true },
    }),
    prisma.lead.findMany({
      where: leadWhere,
      select: { landingId: true, createdAt: true, status: true },
    }),
  ]);

  // ── Agregado por landing ──
  type Row = { landingId: string; views: number; uniques: number; starts: number; leads: number; approved: number };
  const byLanding = new Map<string, Row>();
  const row = (id: string): Row => {
    let r = byLanding.get(id);
    if (!r) {
      r = { landingId: id, views: 0, uniques: 0, starts: 0, leads: 0, approved: 0 };
      byLanding.set(id, r);
    }
    return r;
  };
  for (const s of statRows) {
    const r = row(s.landingId);
    r.views += s.views;
    r.uniques += s.uniques;
    r.starts += s.starts;
  }
  for (const l of leadRows) {
    if (!l.landingId) continue;
    const r = row(l.landingId);
    r.leads += 1;
    if (l.status === "lead") r.approved += 1;
  }

  const withRates = (r: Row) => ({
    ...r,
    landingConvPct: pct(r.starts, r.uniques || r.views), // visita → form abierto
    formConvPct: pct(r.leads, r.starts), // form abierto → lead enviado
    conversionPct: pct(r.leads, r.uniques || r.views), // visita → lead (global)
    approvalPct: pct(r.approved, r.leads), // lead → aprobado
  });

  const landings = [...byLanding.values()]
    .map(withRates)
    .sort((a, b) => b.leads - a.leads || b.uniques - a.uniques);

  const totalsBase = landings.reduce(
    (t, r) => ({
      landingId: "__total__",
      views: t.views + r.views,
      uniques: t.uniques + r.uniques,
      starts: t.starts + r.starts,
      leads: t.leads + r.leads,
      approved: t.approved + r.approved,
    }),
    { landingId: "__total__", views: 0, uniques: 0, starts: 0, leads: 0, approved: 0 } as Row,
  );

  const payload: Record<string, unknown> = {
    from: dayKey(since),
    to: dayKey(new Date(until.getTime() - 86_400_000)),
    landingId,
    totals: withRates(totalsBase),
    landings,
  };

  // ── Serie diaria (opcional) ──
  if (withSeries) {
    type Day = { date: string; views: number; uniques: number; starts: number; leads: number; approved: number };
    const byDay = new Map<string, Day>();
    const day = (d: string): Day => {
      let x = byDay.get(d);
      if (!x) {
        x = { date: d, views: 0, uniques: 0, starts: 0, leads: 0, approved: 0 };
        byDay.set(d, x);
      }
      return x;
    };
    // Pre-poblar todos los días del rango (serie continua para graficar).
    const lastDay = new Date(Math.min(until.getTime(), todayMidnight.getTime() + 86_400_000) - 86_400_000);
    for (let t = since.getTime(); t <= lastDay.getTime(); t += 86_400_000) day(dayKey(new Date(t)));
    for (const s of statRows) {
      const x = day(dayKey(s.date));
      x.views += s.views;
      x.uniques += s.uniques;
      x.starts += s.starts;
    }
    for (const l of leadRows) {
      const x = day(dayKey(l.createdAt));
      x.leads += 1;
      if (l.status === "lead") x.approved += 1;
    }
    payload.series = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  return NextResponse.json(payload);
}
