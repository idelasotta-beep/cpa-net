import Link from "next/link";
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
import { getAbandonedCarts, type CartStatus } from "@/lib/dashboard/abandoned-carts";
import { type Period, formatSantiago, periodRange } from "@/lib/dashboard/dates";
import { resendAbandonedCart } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_META: Record<CartStatus, { label: string; cls: string }> = {
  pending: { label: "Pendiente", cls: "bg-amber-100 text-amber-700" },
  sent: { label: "Enviado", cls: "bg-blue-100 text-blue-700" },
  recovered: { label: "Recuperado", cls: "bg-green-100 text-green-700" },
};

export default async function CarritosPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const period = (sp.period as Period) ?? "30d";
  const { from, to } = periodRange(period, sp.from, sp.to);
  const status = sp.status ?? "all";

  const { rows, counts } = await getAbandonedCarts({ from, to, status });

  const baseParams = new URLSearchParams({
    period,
    ...(sp.from ? { from: sp.from } : {}),
    ...(sp.to ? { to: sp.to } : {}),
  });
  const statusHref = (s: string): string => {
    const p = new URLSearchParams(baseParams.toString());
    if (s === "all") p.delete("status");
    else p.set("status", s);
    return `/carritos?${p.toString()}`;
  };
  const filters: { v: string; l: string; n: number }[] = [
    { v: "all", l: "Todos", n: counts.total },
    { v: "pending", l: "Pendientes", n: counts.pending },
    { v: "sent", l: "Enviados", n: counts.sent },
    { v: "recovered", l: "Recuperados", n: counts.recovered },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Carritos abandonados</h1>
          <p className="text-sm text-muted-foreground">
            Form empezado (teléfono válido) sin completar. Los recuperados compraron.
          </p>
        </div>
        <PeriodSelector current={period} />
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <Link
            key={f.v}
            href={statusHref(f.v)}
            className={
              (status === f.v || (f.v === "all" && status === "all")
                ? "bg-primary text-primary-foreground "
                : "hover:bg-muted ") + "rounded-md border px-3 py-1.5 text-sm"
            }
          >
            {f.l} <span className="opacity-70">({f.n})</span>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Listado</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Sin carritos en este filtro. Aparecen cuando una landing publicada captura un
              teléfono válido y el pedido no se completa.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Landing</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>País</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {formatSantiago(r.createdAt)}
                      </TableCell>
                      <TableCell>{r.name ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{r.phone ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{r.landingId ?? "—"}</TableCell>
                      <TableCell className="text-xs">{r.sku ?? "—"}</TableCell>
                      <TableCell>{r.countryCode ?? "—"}</TableCell>
                      <TableCell>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_META[r.status].cls}`}
                        >
                          {STATUS_META[r.status].label}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {r.status === "recovered" ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <form action={resendAbandonedCart}>
                            <input type="hidden" name="id" value={r.id} />
                            <button
                              type="submit"
                              className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
                            >
                              Reenviar
                            </button>
                          </form>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        &quot;Reenviar&quot; dispara el webhook en el acto (requiere el webhook activo en Ajustes).
        Si pasa a &quot;Enviado&quot;, salió bien.
      </p>
    </div>
  );
}
