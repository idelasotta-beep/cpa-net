import Link from "next/link";
import { ApprovalHeatmap } from "@/components/charts/approval-heatmap";
import { OfferFilter } from "@/components/offer-filter";
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
import { formatPct } from "@/lib/dashboard/metrics";
import { type DimRow, getInsights, getOffersWithLeads } from "@/lib/dashboard/queries";
import { CHANNEL_LABEL, PLATFORM_LABEL } from "@/lib/dashboard/status-labels";

export const dynamic = "force-dynamic";

function DimTable({
  title,
  rows,
  labelHeader,
  labelFn,
}: {
  title: string;
  rows: DimRow[];
  labelHeader: string;
  labelFn?: (key: string) => string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Sin datos suficientes</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{labelHeader}</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead className="text-right">Approval</TableHead>
                <TableHead className="text-right">Quality</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.key}>
                  <TableCell>{labelFn ? labelFn(r.key) : r.key}</TableCell>
                  <TableCell className="text-right">{r.total}</TableCell>
                  <TableCell className="text-right">{formatPct(r.approval)}</TableCell>
                  <TableCell className="text-right">{formatPct(r.quality)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string; offerId?: string }>;
}) {
  const sp = await searchParams;
  const period = (sp.period as Period) ?? "30d";
  const { from, to } = periodRange(period, sp.from, sp.to);

  const [insights, offers] = await Promise.all([
    getInsights(from, to, sp.offerId),
    getOffersWithLeads(),
  ]);

  const baseParams = new URLSearchParams({
    period,
    ...(sp.from ? { from: sp.from } : {}),
    ...(sp.to ? { to: sp.to } : {}),
  });
  const baseQs = baseParams.toString();
  const drillHref = (offerId: string) => {
    const p = new URLSearchParams(baseQs);
    p.set("offerId", offerId);
    return `/insights?${p.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Insights</h1>
        <div className="flex flex-wrap items-center gap-2">
          <OfferFilter offers={offers} value={sp.offerId} />
          <PeriodSelector current={period} />
        </div>
      </div>

      {/* Por oferta (con drill-down) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Por oferta</CardTitle>
          {sp.offerId ? (
            <Link href={`/insights?${baseQs}`} className="text-xs underline">
              ← Ver todas
            </Link>
          ) : (
            <span className="text-xs text-muted-foreground">
              Click en una oferta para desglosar todos los cortes
            </span>
          )}
        </CardHeader>
        <CardContent>
          {insights.offerRows.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Sin datos</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table className="min-w-[560px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Oferta</TableHead>
                    <TableHead>País</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">Approval</TableHead>
                    <TableHead className="text-right">Quality</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {insights.offerRows.map((o) => (
                    <TableRow key={o.offerId}>
                      <TableCell>
                        <Link href={drillHref(o.offerId)} className="font-medium hover:underline">
                          {o.name}
                        </Link>
                      </TableCell>
                      <TableCell>{o.country}</TableCell>
                      <TableCell className="text-right">{o.total}</TableCell>
                      <TableCell className="text-right">{formatPct(o.approval)}</TableCell>
                      <TableCell className="text-right">{formatPct(o.quality)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Approval rate por hora y día</CardTitle>
        </CardHeader>
        <CardContent>
          <ApprovalHeatmap data={insights.heatmap} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <DimTable
          title="Por plataforma"
          rows={insights.platformRows}
          labelHeader="Plataforma"
          labelFn={(k) => PLATFORM_LABEL[k as keyof typeof PLATFORM_LABEL] ?? k}
        />
        <DimTable
          title="Por canal"
          rows={insights.channelRows}
          labelHeader="Canal"
          labelFn={(k) => CHANNEL_LABEL[k as keyof typeof CHANNEL_LABEL] ?? k}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <DimTable title="Por región" rows={insights.regionRows} labelHeader="Región" />
        <DimTable
          title="Por dirección (con/sin dirección cargada)"
          rows={insights.addressRows}
          labelHeader="Dirección"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <DimTable title="Top ciudades (mín 20 leads)" rows={insights.cityTop} labelHeader="Ciudad" />
        <DimTable title="Bottom ciudades (mín 20 leads)" rows={insights.cityBottom} labelHeader="Ciudad" />
      </div>

      <DimTable title="Top campañas (utm_campaign)" rows={insights.campaignRows} labelHeader="Campaña" />
    </div>
  );
}
