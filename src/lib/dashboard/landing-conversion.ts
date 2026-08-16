import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Analítica de conversión de las landings propias. Embudo:
 *   visita → form abierto (start) → lead → aprobado.
 * Fuente: LandingStat (beacon, agregado por día) + Lead (atribuido por landingId).
 * La usan el endpoint admin (JSON) y la página del dashboard (misma lógica, sin duplicar).
 */

export interface LandingRow {
  landingId: string;
  views: number;
  uniques: number;
  starts: number;
  leads: number;
  approved: number;
  landingConvPct: number | null; // visita → abrió form (starts/únicos)
  formConvPct: number | null; // abrió form → lead (leads/starts)
  conversionPct: number | null; // visita → lead (global)
  approvalPct: number | null; // lead → aprobado
}

export interface LandingSeriesPoint {
  date: string;
  views: number;
  uniques: number;
  starts: number;
  leads: number;
  approved: number;
}

export interface LandingConversion {
  totals: LandingRow;
  landings: LandingRow[];
  series: LandingSeriesPoint[];
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const pct = (num: number, den: number): number | null =>
  den > 0 ? Math.round((num / den) * 1000) / 10 : null;

interface Counts {
  landingId: string;
  views: number;
  uniques: number;
  starts: number;
  leads: number;
  approved: number;
}

function withRates(r: Counts): LandingRow {
  return {
    ...r,
    landingConvPct: pct(r.starts, r.uniques || r.views),
    formConvPct: pct(r.leads, r.starts),
    conversionPct: pct(r.leads, r.uniques || r.views),
    approvalPct: pct(r.approved, r.leads),
  };
}

export async function getLandingConversion({
  from,
  to,
  landingId,
  withSeries,
}: {
  from: Date;
  to: Date;
  landingId?: string | null;
  withSeries?: boolean;
}): Promise<LandingConversion> {
  const statWhere: Prisma.LandingStatWhereInput = {
    date: { gte: from, lt: to },
    ...(landingId ? { landingId } : {}),
  };
  const leadWhere: Prisma.LeadWhereInput = {
    platform: "landing",
    landingId: landingId ? landingId : { not: null },
    createdAt: { gte: from, lt: to },
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
  const byLanding = new Map<string, Counts>();
  const row = (id: string): Counts => {
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

  const landings = [...byLanding.values()]
    .map(withRates)
    .sort((a, b) => b.leads - a.leads || b.uniques - a.uniques);

  const totalsBase = landings.reduce<Counts>(
    (t, r) => ({
      landingId: "__total__",
      views: t.views + r.views,
      uniques: t.uniques + r.uniques,
      starts: t.starts + r.starts,
      leads: t.leads + r.leads,
      approved: t.approved + r.approved,
    }),
    { landingId: "__total__", views: 0, uniques: 0, starts: 0, leads: 0, approved: 0 },
  );

  const series: LandingSeriesPoint[] = [];
  if (withSeries) {
    const byDay = new Map<string, LandingSeriesPoint>();
    const day = (d: string): LandingSeriesPoint => {
      let x = byDay.get(d);
      if (!x) {
        x = { date: d, views: 0, uniques: 0, starts: 0, leads: 0, approved: 0 };
        byDay.set(d, x);
      }
      return x;
    };
    // Días continuos del rango (para graficar sin huecos). `to` es exclusivo, así que
    // el último día incluido es `to - 1día`, capado al día de hoy (sin días futuros).
    const todayMid = new Date();
    todayMid.setUTCHours(0, 0, 0, 0);
    const lastDayMs = Math.min(to.getTime() - 86_400_000, todayMid.getTime());
    for (let t = from.getTime(); t <= lastDayMs; t += 86_400_000) day(dayKey(new Date(t)));
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
    series.push(...[...byDay.values()].sort((a, b) => a.date.localeCompare(b.date)));
  }

  return { totals: withRates(totalsBase), landings, series };
}
