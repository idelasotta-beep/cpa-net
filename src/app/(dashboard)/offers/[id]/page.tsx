import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type Period, periodRange } from "@/lib/dashboard/dates";
import {
  approvalRate,
  formatPct,
  qualityApprovalRate,
  totalLeads,
} from "@/lib/dashboard/metrics";
import { getOfferById, getOfferFunnel } from "@/lib/dashboard/queries";
import { ORDERED_STATUSES, STATUS_COLOR, STATUS_LABEL } from "@/lib/dashboard/status-labels";

export const dynamic = "force-dynamic";

export default async function OfferDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const period = (sp.period as Period) ?? "30d";
  const { from, to } = periodRange(period, sp.from, sp.to);

  const offer = await getOfferById(id);
  if (!offer) notFound();

  const counts = await getOfferFunnel(id, from, to);
  const total = totalLeads(counts);

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/offers?period=${period}`} className="text-sm text-muted-foreground hover:underline">
          ← Ofertas
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{offer.name}</h1>
        <p className="text-sm text-muted-foreground">
          {offer.country} · Adcombo #{offer.networkOfferId} · payout {Number(offer.payoutUsd)} USD
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Approval rate</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatPct(approvalRate(counts))}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Quality approval</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatPct(qualityApprovalRate(counts))}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Leads totales</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{total}</CardContent>
        </Card>
      </div>

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
