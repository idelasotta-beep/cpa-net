import Link from "next/link";
import { LeadsPerDayChart } from "@/components/charts/leads-per-day-chart";
import { PeriodSelector } from "@/components/period-selector";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { type Period, periodRange } from "@/lib/dashboard/dates";
import { formatPct, formatUsd } from "@/lib/dashboard/metrics";
import {
  getLeadsPerDay,
  getOfferPerformance,
  getSummary,
} from "@/lib/dashboard/queries";

export const dynamic = "force-dynamic";

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
      </CardContent>
    </Card>
  );
}

export default async function ResumenPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const period = (sp.period as Period) ?? "7d";
  const { from, to } = periodRange(period, sp.from, sp.to);

  const [summary, perDay, offers] = await Promise.all([
    getSummary(from, to),
    getLeadsPerDay(from, to),
    getOfferPerformance(from, to),
  ]);
  const top = offers.slice(0, 3);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Resumen</h1>
        <PeriodSelector current={period} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Leads totales" value={String(summary.total)} />
        <Kpi
          label="Approval rate"
          value={formatPct(summary.approval)}
          sub={`Quality: ${formatPct(summary.quality)}`}
        />
        <Kpi label="Revenue confirmado" value={formatUsd(summary.revenue)} />
        <Kpi label="Costo del período" value={formatUsd(summary.cost)} />
        <Kpi label="Profit" value={formatUsd(summary.profit)} />
        <Kpi
          label="ROI"
          value={summary.cost === 0 ? "—" : formatPct(summary.roi)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Leads por día</CardTitle>
        </CardHeader>
        <CardContent>
          <LeadsPerDayChart data={perDay} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top 3 ofertas por profit</CardTitle>
        </CardHeader>
        <CardContent>
          {top.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Sin ofertas con leads en el período
            </p>
          ) : (
            <ul className="divide-y">
              {top.map((o) => (
                <li key={o.offerId} className="flex items-center justify-between py-2">
                  <Link href={`/offers/${o.offerId}`} className="text-sm hover:underline">
                    {o.name} <span className="text-muted-foreground">({o.country})</span>
                  </Link>
                  <span className="text-sm font-medium">{formatUsd(o.profit)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
