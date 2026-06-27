import type { LeadStatus } from "@prisma/client";

/** Conteo de leads por status canónico. */
export type StatusCounts = Record<LeadStatus, number>;

export function emptyCounts(): StatusCounts {
  return {
    pending: 0,
    sent_to_network: 0,
    hold: 0,
    lead: 0,
    reject: 0,
    trash: 0,
    failed: 0,
  };
}

/** approval_rate = lead / (lead + reject). Devuelve 0..1 (0 si no hay base). */
export function approvalRate(c: StatusCounts): number {
  const denom = c.lead + c.reject;
  return denom === 0 ? 0 : c.lead / denom;
}

/** quality = lead / (lead + reject + trash). */
export function qualityApprovalRate(c: StatusCounts): number {
  const denom = c.lead + c.reject + c.trash;
  return denom === 0 ? 0 : c.lead / denom;
}

export function profit(revenueUsd: number, costUsd: number): number {
  return revenueUsd - costUsd;
}

/** ROI = (revenue − cost) / cost. 0 si no hay costo. */
export function roi(revenueUsd: number, costUsd: number): number {
  return costUsd === 0 ? 0 : (revenueUsd - costUsd) / costUsd;
}

export function totalLeads(c: StatusCounts): number {
  return (
    c.pending +
    c.sent_to_network +
    c.hold +
    c.lead +
    c.reject +
    c.trash +
    c.failed
  );
}

/** Leads que llegaron a procesarse (base para approval rate). */
export function processedLeads(c: StatusCounts): number {
  return c.lead + c.reject + c.trash;
}

export function formatPct(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

export function formatUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}
