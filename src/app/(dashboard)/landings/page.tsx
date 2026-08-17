import Link from "next/link";
import { LandingTrend } from "@/components/charts/landing-trend";
import { LiveVisitors } from "@/components/live-visitors";
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
import { getLandingConversion, type LandingRow } from "@/lib/dashboard/landing-conversion";

export const dynamic = "force-dynamic";

function pctFmt(v: number | null): string {
  return v == null ? "—" : `${v}%`;
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

export default async function LandingsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string; landingId?: string }>;
}) {
  const sp = await searchParams;
  const period = (sp.period as Period) ?? "30d";
  const { from, to } = periodRange(period, sp.from, sp.to);
  const landingId = sp.landingId?.trim() || null;

  const { totals, landings, series } = await getLandingConversion({
    from,
    to,
    landingId,
    withSeries: true,
  });

  const baseParams = new URLSearchParams({
    period,
    ...(sp.from ? { from: sp.from } : {}),
    ...(sp.to ? { to: sp.to } : {}),
  });
  const drillHref = (id: string): string => {
    const p = new URLSearchParams(baseParams.toString());
    p.set("landingId", id);
    return `/landings?${p.toString()}`;
  };

  const t = totals as LandingRow;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Conversión de landings</h1>
          <p className="text-sm text-muted-foreground">
            Embudo: visita → abrió el form → lead → aprobado
          </p>
        </div>
        <PeriodSelector current={period} />
      </div>

      <LiveVisitors />

      {landingId ? (
        <p className="text-sm">
          Filtrando por landing <span className="font-mono">{landingId}</span> ·{" "}
          <Link href={`/landings?${baseParams.toString()}`} className="underline">
            ← Ver todas
          </Link>
        </p>
      ) : null}

      {/* Totales */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <StatCard label="Visitas" value={String(t.views)} />
        <StatCard label="Únicos" value={String(t.uniques)} />
        <StatCard label="Abrió form" value={String(t.starts)} hint={pctFmt(t.landingConvPct)} />
        <StatCard label="Leads" value={String(t.leads)} hint={pctFmt(t.formConvPct)} />
        <StatCard label="Conversión" value={pctFmt(t.conversionPct)} hint="lead / único" />
        <StatCard label="Aprobación" value={pctFmt(t.approvalPct)} hint={`${t.approved} aprobados`} />
      </div>

      {/* Tendencia diaria */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evolución diaria</CardTitle>
        </CardHeader>
        <CardContent>
          <LandingTrend series={series} />
        </CardContent>
      </Card>

      {/* Por landing */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Por landing</CardTitle>
        </CardHeader>
        <CardContent>
          {landings.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Sin datos en el período. Las visitas aparecen cuando una landing publicada recibe
              tráfico.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table className="min-w-[820px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Landing</TableHead>
                    <TableHead className="text-right">Visitas</TableHead>
                    <TableHead className="text-right">Únicos</TableHead>
                    <TableHead className="text-right">Abrió form</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">Aprob.</TableHead>
                    <TableHead className="text-right">Conv. landing</TableHead>
                    <TableHead className="text-right">Conv. form</TableHead>
                    <TableHead className="text-right">Conv. global</TableHead>
                    <TableHead className="text-right">Aprobación</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {landings.map((r) => (
                    <TableRow key={r.landingId}>
                      <TableCell className="font-mono text-xs">
                        <Link href={drillHref(r.landingId)} className="hover:underline">
                          {r.landingId}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right">{r.views}</TableCell>
                      <TableCell className="text-right">{r.uniques}</TableCell>
                      <TableCell className="text-right">{r.starts}</TableCell>
                      <TableCell className="text-right font-medium">{r.leads}</TableCell>
                      <TableCell className="text-right">{r.approved}</TableCell>
                      <TableCell className="text-right">{pctFmt(r.landingConvPct)}</TableCell>
                      <TableCell className="text-right">{pctFmt(r.formConvPct)}</TableCell>
                      <TableCell className="text-right font-medium">{pctFmt(r.conversionPct)}</TableCell>
                      <TableCell className="text-right">{pctFmt(r.approvalPct)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Conv. landing = abrió form / únicos · Conv. form = leads / abrió form · Conv. global = leads
        / únicos · Aprobación = aprobados / leads.
      </p>
    </div>
  );
}
