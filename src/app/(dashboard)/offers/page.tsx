import Link from "next/link";
import { PeriodSelector } from "@/components/period-selector";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type Period, periodRange } from "@/lib/dashboard/dates";
import { formatPct, formatUsd } from "@/lib/dashboard/metrics";
import { getOfferPerformance } from "@/lib/dashboard/queries";

export const dynamic = "force-dynamic";

export default async function OffersPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const period = (sp.period as Period) ?? "30d";
  const { from, to } = periodRange(period, sp.from, sp.to);
  const offers = await getOfferPerformance(from, to);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Performance por oferta</h1>
        <PeriodSelector current={period} />
      </div>

      {offers.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Sin ofertas con leads en el período
        </p>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Oferta</TableHead>
                <TableHead>País</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead className="text-right">Enviados</TableHead>
                <TableHead className="text-right">Approval</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Costo</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead className="text-right">Profit/lead</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {offers.map((o) => (
                <TableRow key={o.offerId}>
                  <TableCell>
                    <Link
                      href={`/offers/${o.offerId}?period=${period}`}
                      className="font-medium hover:underline"
                    >
                      {o.name}
                    </Link>
                  </TableCell>
                  <TableCell>{o.country}</TableCell>
                  <TableCell className="text-right">{o.total}</TableCell>
                  <TableCell className="text-right">{o.sent}</TableCell>
                  <TableCell className="text-right">{formatPct(o.approval)}</TableCell>
                  <TableCell className="text-right">{formatUsd(o.revenue)}</TableCell>
                  <TableCell className="text-right">{formatUsd(o.cost)}</TableCell>
                  <TableCell className="text-right font-medium">{formatUsd(o.profit)}</TableCell>
                  <TableCell className="text-right">{formatUsd(o.profitPerLead)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
