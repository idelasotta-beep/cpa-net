import Link from "next/link";
import { notFound } from "next/navigation";
import { ApprovalTrendChart } from "@/components/charts/approval-trend-chart";
import { PeriodSelector } from "@/components/period-selector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type Period, periodRange } from "@/lib/dashboard/dates";
import {
  approvalRate,
  formatCpa,
  formatPct,
  qualityApprovalRate,
  totalLeads,
} from "@/lib/dashboard/metrics";
import {
  type Bucket,
  getOfferApprovalOverTime,
  getOfferById,
  getOfferCost,
  getOfferFunnel,
} from "@/lib/dashboard/queries";
import { ORDERED_STATUSES, STATUS_COLOR, STATUS_LABEL } from "@/lib/dashboard/status-labels";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OfferDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string; from?: string; to?: string; bucket?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const period = (sp.period as Period) ?? "30d";
  const { from, to } = periodRange(period, sp.from, sp.to);
  const bucket = (["day", "week", "month"].includes(sp.bucket ?? "") ? sp.bucket : "day") as Bucket;

  const offer = await getOfferById(id);
  if (!offer) notFound();

  const [counts, series, cost] = await Promise.all([
    getOfferFunnel(id, from, to),
    getOfferApprovalOverTime(id, from, to, bucket),
    getOfferCost(from, to, id),
  ]);
  const total = totalLeads(counts);

  const periodQs = new URLSearchParams({
    period,
    ...(sp.from ? { from: sp.from } : {}),
    ...(sp.to ? { to: sp.to } : {}),
  }).toString();
  const BUCKETS: { v: Bucket; l: string }[] = [
    { v: "day", l: "Día" },
    { v: "week", l: "Semana" },
    { v: "month", l: "Mes" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/offers?period=${period}`} className="text-sm text-muted-foreground hover:underline">
            ← Ofertas
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">{offer.name}</h1>
          <p className="text-sm text-muted-foreground">
            {offer.country} · #{offer.networkOfferId} · payout {Number(offer.payoutUsd)} USD
          </p>
        </div>
        <PeriodSelector current={period} />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Approval sin Trash</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatPct(approvalRate(counts))}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Approval con Trash</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatPct(qualityApprovalRate(counts))}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">CPA Inicial</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatCpa(cost, total)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">CPA Real</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatCpa(cost, counts.lead)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Leads totales</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{total}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Approval / Quality por período</CardTitle>
          <div className="flex gap-1">
            {BUCKETS.map((b) => (
              <Link
                key={b.v}
                href={`/offers/${id}?${periodQs}&bucket=${b.v}`}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs",
                  bucket === b.v ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
              >
                {b.l}
              </Link>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <ApprovalTrendChart data={series} />
          {series.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border">
              <Table className="min-w-[520px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Período</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">Procesados</TableHead>
                    <TableHead className="text-right">Approval sin Trash</TableHead>
                    <TableHead className="text-right">Approval con Trash</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {series.map((r) => (
                    <TableRow key={r.bucket}>
                      <TableCell className="whitespace-nowrap">{r.bucket}</TableCell>
                      <TableCell className="text-right">{r.total}</TableCell>
                      <TableCell className="text-right">{r.processed}</TableCell>
                      <TableCell className="text-right">{formatPct(r.approval)}</TableCell>
                      <TableCell className="text-right">{formatPct(r.quality)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Distribución por estado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {total === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Sin leads en el período</p>
          ) : (
            ORDERED_STATUSES.map((s) => {
              const n = counts[s];
              const pct = total === 0 ? 0 : (n / total) * 100;
              return (
                <div key={s} className="flex items-center gap-3">
                  <span className="w-24 text-sm">{STATUS_LABEL[s]}</span>
                  <div className="h-3 flex-1 overflow-hidden rounded bg-muted">
                    <div
                      className="h-full"
                      style={{ width: `${pct}%`, backgroundColor: STATUS_COLOR[s] }}
                    />
                  </div>
                  <span className="w-16 text-right text-sm tabular-nums">
                    {n} <span className="text-muted-foreground">({pct.toFixed(0)}%)</span>
                  </span>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
