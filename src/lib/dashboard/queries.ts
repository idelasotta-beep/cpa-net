import type { LeadSource, LeadStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { santiagoDayKey, santiagoHour, santiagoWeekday } from "./dates";
import {
  approvalRate,
  type StatusCounts,
  emptyCounts,
  processedLeads,
  profit,
  qualityApprovalRate,
  roi,
} from "./metrics";

function dec(v: Prisma.Decimal | number | null | undefined): number {
  return v == null ? 0 : Number(v);
}

interface LeadLite {
  status: LeadStatus;
  revenueUsd: Prisma.Decimal | null;
  offerId: string | null;
  createdAt: Date;
  customerCity: string | null;
  source: LeadSource;
  utmCampaign: string | null;
}

async function fetchLeads(where: Prisma.LeadWhereInput): Promise<LeadLite[]> {
  return prisma.lead.findMany({
    where,
    select: {
      status: true,
      revenueUsd: true,
      offerId: true,
      createdAt: true,
      customerCity: true,
      source: true,
      utmCampaign: true,
    },
  });
}

function countByStatus(leads: { status: LeadStatus }[]): StatusCounts {
  const c = emptyCounts();
  for (const l of leads) c[l.status]++;
  return c;
}

function revenueOf(leads: LeadLite[]): number {
  return leads.reduce(
    (sum, l) => (l.status === "lead" ? sum + dec(l.revenueUsd) : sum),
    0,
  );
}

async function costInRange(from: Date, to: Date, offerId?: string): Promise<number> {
  const agg = await prisma.dailyCost.aggregate({
    _sum: { amountUsd: true },
    where: { date: { gte: from, lte: to }, ...(offerId ? { offerId } : {}) },
  });
  return dec(agg._sum.amountUsd);
}

// ── Vista 1: Resumen ──
export async function getSummary(from: Date, to: Date) {
  const leads = await fetchLeads({ createdAt: { gte: from, lte: to } });
  const counts = countByStatus(leads);
  const revenue = revenueOf(leads);
  const cost = await costInRange(from, to);
  return {
    counts,
    total: leads.length,
    revenue,
    cost,
    profit: profit(revenue, cost),
    roi: roi(revenue, cost),
    approval: approvalRate(counts),
    quality: qualityApprovalRate(counts),
  };
}

export type LeadsPerDayRow = { day: string } & Record<LeadStatus, number>;

export async function getLeadsPerDay(from: Date, to: Date): Promise<LeadsPerDayRow[]> {
  const leads = await fetchLeads({ createdAt: { gte: from, lte: to } });
  const byDay = new Map<string, StatusCounts>();
  for (const l of leads) {
    const key = santiagoDayKey(l.createdAt);
    const c = byDay.get(key) ?? emptyCounts();
    c[l.status]++;
    byDay.set(key, c);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, c]) => ({ day, ...c }));
}

// ── Vista 2: Performance por oferta ──
export interface OfferRow {
  offerId: string;
  name: string;
  country: string;
  total: number;
  sent: number;
  approval: number;
  revenue: number;
  cost: number;
  profit: number;
  profitPerLead: number;
}

export async function getOfferPerformance(from: Date, to: Date): Promise<OfferRow[]> {
  const leads = await fetchLeads({
    createdAt: { gte: from, lte: to },
    offerId: { not: null },
  });
  if (leads.length === 0) return [];

  const byOffer = new Map<string, LeadLite[]>();
  for (const l of leads) {
    const k = l.offerId!;
    (byOffer.get(k) ?? byOffer.set(k, []).get(k)!).push(l);
  }

  const offerIds = [...byOffer.keys()];
  const offers = await prisma.offer.findMany({
    where: { id: { in: offerIds } },
    select: { id: true, name: true, country: true },
  });
  const offerMap = new Map(offers.map((o) => [o.id, o]));

  const costs = await prisma.dailyCost.groupBy({
    by: ["offerId"],
    _sum: { amountUsd: true },
    where: { date: { gte: from, lte: to }, offerId: { in: offerIds } },
  });
  const costMap = new Map(costs.map((c) => [c.offerId, dec(c._sum.amountUsd)]));

  const rows: OfferRow[] = offerIds.map((id) => {
    const group = byOffer.get(id)!;
    const counts = countByStatus(group);
    const revenue = revenueOf(group);
    const cost = costMap.get(id) ?? 0;
    const sent = counts.sent_to_network + counts.hold + counts.lead + counts.reject + counts.trash;
    const total = group.length;
    const o = offerMap.get(id);
    return {
      offerId: id,
      name: o?.name ?? id,
      country: o?.country ?? "",
      total,
      sent,
      approval: approvalRate(counts),
      revenue,
      cost,
      profit: profit(revenue, cost),
      profitPerLead: total === 0 ? 0 : profit(revenue, cost) / total,
    };
  });

  return rows.sort((a, b) => b.profit - a.profit);
}

export async function getOfferById(id: string) {
  return prisma.offer.findUnique({ where: { id } });
}

export async function getOfferFunnel(offerId: string, from: Date, to: Date) {
  const leads = await fetchLeads({ offerId, createdAt: { gte: from, lte: to } });
  return countByStatus(leads);
}

// ── Vista 3: Insights ──
const MIN_LEADS = 20;

export interface DimRow {
  key: string;
  total: number;
  processed: number;
  approval: number;
  quality: number;
}

function aggregateBy(leads: LeadLite[], keyOf: (l: LeadLite) => string | null): DimRow[] {
  const groups = new Map<string, LeadLite[]>();
  for (const l of leads) {
    const k = keyOf(l);
    if (!k) continue;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(l);
  }
  return [...groups.entries()].map(([key, ls]) => {
    const c = countByStatus(ls);
    return {
      key,
      total: ls.length,
      processed: processedLeads(c),
      approval: approvalRate(c),
      quality: qualityApprovalRate(c),
    };
  });
}

export async function getInsights(from: Date, to: Date, offerId?: string) {
  const leads = await fetchLeads({
    createdAt: { gte: from, lte: to },
    ...(offerId ? { offerId } : {}),
  });

  // Por ciudad (mín 20 leads), top y bottom 20.
  const cityRows = aggregateBy(leads, (l) => l.customerCity)
    .filter((r) => r.total >= MIN_LEADS)
    .sort((a, b) => b.approval - a.approval);
  const cityTop = cityRows.slice(0, 20);
  const cityBottom = cityRows.slice(-20).reverse();

  // Por source.
  const sourceRows = aggregateBy(leads, (l) => l.source).sort(
    (a, b) => b.total - a.total,
  );

  // Por campaña.
  const campaignRows = aggregateBy(leads, (l) => l.utmCampaign)
    .sort((a, b) => b.approval - a.approval)
    .slice(0, 20);

  // Heatmap hora (0-23) × día semana (0-6): approval rate por celda.
  const cell = new Map<string, StatusCounts>();
  for (const l of leads) {
    const k = `${santiagoWeekday(l.createdAt)}-${santiagoHour(l.createdAt)}`;
    const c = cell.get(k) ?? emptyCounts();
    c[l.status]++;
    cell.set(k, c);
  }
  const heatmap: { weekday: number; hour: number; total: number; approval: number }[] = [];
  for (const [k, c] of cell) {
    const [wd, hr] = k.split("-").map(Number);
    heatmap.push({
      weekday: wd!,
      hour: hr!,
      total: c.lead + c.reject + c.trash + c.hold + c.sent_to_network + c.pending + c.failed,
      approval: approvalRate(c),
    });
  }

  return { cityTop, cityBottom, sourceRows, campaignRows, heatmap, totalLeads: leads.length };
}

// ── Vista 4: Leads ──
export interface LeadFilters {
  status?: LeadStatus[];
  source?: LeadSource;
  offerId?: string;
  city?: string;
  from?: Date;
  to?: Date;
  search?: string;
  page: number;
}

const PAGE_SIZE = 50;

export async function getLeadsPage(f: LeadFilters) {
  const where: Prisma.LeadWhereInput = {
    ...(f.status && f.status.length ? { status: { in: f.status } } : {}),
    ...(f.source ? { source: f.source } : {}),
    ...(f.offerId ? { offerId: f.offerId } : {}),
    ...(f.city ? { customerCity: { contains: f.city, mode: "insensitive" } } : {}),
    ...(f.from || f.to
      ? { createdAt: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lte: f.to } : {}) } }
      : {}),
    ...(f.search
      ? {
          OR: [
            { customerName: { contains: f.search, mode: "insensitive" } },
            { customerPhone: { contains: f.search } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: { offer: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (f.page - 1) * PAGE_SIZE,
    }),
    prisma.lead.count({ where }),
  ]);

  return { rows, total, page: f.page, pageSize: PAGE_SIZE, pages: Math.ceil(total / PAGE_SIZE) };
}

export async function getLeadDetail(id: string) {
  return prisma.lead.findUnique({
    where: { id },
    include: {
      offer: { select: { name: true, networkOfferId: true } },
      statusHistory: { orderBy: { changedAt: "desc" } },
    },
  });
}

// ── Vista 5: Costos + selects ──
export async function getCosts() {
  return prisma.dailyCost.findMany({
    include: { offer: { select: { name: true } } },
    orderBy: { date: "desc" },
  });
}

/** Ofertas activas (todas las redes) para el select de creación manual de lead. */
export async function getActiveOffers() {
  return prisma.offer.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      country: true,
      networkOfferId: true,
      network: { select: { name: true, slug: true } },
    },
    orderBy: [{ network: { name: "asc" } }, { country: "asc" }, { name: "asc" }],
  });
}

/** Ofertas que aparecen en leads (para selects de filtros y costos). */
export async function getOffersWithLeads() {
  const grouped = await prisma.lead.groupBy({
    by: ["offerId"],
    where: { offerId: { not: null } },
  });
  const ids = grouped.map((g) => g.offerId!).filter(Boolean);
  if (ids.length === 0) return [];
  return prisma.offer.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, country: true },
    orderBy: { name: "asc" },
  });
}

export { PAGE_SIZE };
