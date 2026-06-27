import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCosts, getOffersWithLeads } from "@/lib/dashboard/queries";
import { deleteCost, upsertCost } from "./actions";

export const dynamic = "force-dynamic";

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export default async function CostsPage() {
  const [costs, offers] = await Promise.all([getCosts(), getOffersWithLeads()]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Costos publicitarios</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cargar / actualizar costo</CardTitle>
        </CardHeader>
        <CardContent>
          {offers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay ofertas con leads todavía. Los costos se cargan sobre ofertas que ya recibieron leads.
            </p>
          ) : (
            <form action={upsertCost} className="flex flex-wrap items-end gap-2">
              <select name="offerId" required className="rounded-md border bg-background px-2 py-1.5 text-sm">
                {offers.map((o) => (
                  <option key={o.id} value={o.id}>{o.name} ({o.country})</option>
                ))}
              </select>
              <input name="date" type="date" required className="rounded-md border bg-background px-2 py-1.5 text-sm" />
              <input name="amountUsd" type="number" step="0.01" min="0" placeholder="USD" required className="w-28 rounded-md border bg-background px-2 py-1.5 text-sm" />
              <input name="notes" placeholder="Notas (opcional)" className="rounded-md border bg-background px-2 py-1.5 text-sm" />
              <button type="submit" className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground">
                Guardar
              </button>
            </form>
          )}
        </CardContent>
      </Card>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Oferta</TableHead>
              <TableHead>Monto USD</TableHead>
              <TableHead>Notas</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {costs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  Sin costos cargados
                </TableCell>
              </TableRow>
            ) : (
              costs.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="whitespace-nowrap">{ymd(c.date)}</TableCell>
                  <TableCell>{c.offer.name}</TableCell>
                  <TableCell colSpan={2}>
                    <form action={upsertCost} className="flex items-center gap-2">
                      <input type="hidden" name="offerId" value={c.offerId} />
                      <input type="hidden" name="date" value={ymd(c.date)} />
                      <input
                        name="amountUsd"
                        type="number"
                        step="0.01"
                        defaultValue={Number(c.amountUsd)}
                        className="w-24 rounded-md border bg-background px-2 py-1 text-sm"
                      />
                      <input
                        name="notes"
                        defaultValue={c.notes ?? ""}
                        placeholder="Notas"
                        className="flex-1 rounded-md border bg-background px-2 py-1 text-sm"
                      />
                      <button type="submit" className="rounded-md border px-2 py-1 text-xs hover:bg-muted">
                        Guardar
                      </button>
                    </form>
                  </TableCell>
                  <TableCell className="text-right">
                    <form action={deleteCost}>
                      <input type="hidden" name="id" value={c.id} />
                      <button type="submit" className="rounded-md border px-2 py-1 text-xs text-destructive hover:bg-muted">
                        Borrar
                      </button>
                    </form>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
