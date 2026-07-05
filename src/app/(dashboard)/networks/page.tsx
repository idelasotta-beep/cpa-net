import Link from "next/link";
import { deleteOffer, upsertOffer } from "@/app/(dashboard)/networks/actions";
import { createNetwork } from "@/app/(dashboard)/networks/actions";
import {
  Card,
  CardContent,
  CardDescription,
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
import { cn } from "@/lib/utils";
import { getNetworks, getOffersByNetwork, getOfferById } from "@/lib/dashboard/queries";

export const dynamic = "force-dynamic";

const inputCls = "rounded-md border bg-background px-2 py-1.5 text-sm";

export default async function NetworksPage({
  searchParams,
}: {
  searchParams: Promise<{ network?: string; q?: string; edit?: string }>;
}) {
  const sp = await searchParams;
  const networks = await getNetworks();
  const selectedId = sp.network || networks[0]?.id || "";
  const [offers, editOffer] = await Promise.all([
    selectedId ? getOffersByNetwork(selectedId, sp.q) : Promise.resolve([]),
    sp.edit ? getOfferById(sp.edit) : Promise.resolve(null),
  ]);
  const ed = editOffer && editOffer.networkId === selectedId ? editOffer : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Redes y ofertas</h1>

      {/* Redes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Redes CPA</CardTitle>
          <CardDescription>
            El envío se controla en <Link href="/settings" className="underline">Ajustes</Link> (toggle por red).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="divide-y">
            {networks.map((n) => (
              <li key={n.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  <span className="font-medium">{n.name}</span>{" "}
                  <span className="text-muted-foreground">({n.slug})</span>
                  {!n.active ? " · inactiva" : ""}
                  {n.pushEnabled ? " · envío ON" : " · envío pausado"}
                </span>
                <Link
                  href={`/networks?network=${n.id}`}
                  className={cn("rounded-md border px-2 py-1 text-xs hover:bg-muted", selectedId === n.id && "bg-muted")}
                >
                  Ofertas
                </Link>
              </li>
            ))}
          </ul>

          <form action={createNetwork} className="flex flex-wrap items-end gap-2 border-t pt-4">
            <input name="slug" placeholder="slug (ej. latinleads)" required className={inputCls} />
            <input name="name" placeholder="Nombre" required className={inputCls} />
            <button type="submit" className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground">
              Crear red
            </button>
          </form>
        </CardContent>
      </Card>

      {/* Ofertas de la red seleccionada */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Ofertas · {networks.find((n) => n.id === selectedId)?.name ?? "—"}
          </CardTitle>
          <CardDescription>
            <strong>Goods ID</strong> = id del producto en la red · <strong>Producto (trigger)</strong> = el
            dropi_product_id que dispara esta oferta cuando entra un lead.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Alta/edición */}
          <form action={upsertOffer} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <input type="hidden" name="networkId" value={selectedId} />
            <input name="networkOfferId" placeholder="Goods ID" defaultValue={ed?.networkOfferId ?? ""} required className={inputCls} />
            <input name="name" placeholder="Nombre" defaultValue={ed?.name ?? ""} required className={inputCls} />
            <input name="country" placeholder="País ISO2 (ej. CL)" defaultValue={ed?.country ?? ""} required className={inputCls} />
            <input name="payoutUsd" type="number" step="0.01" placeholder="Payout USD" defaultValue={ed ? Number(ed.payoutUsd) : ""} required className={inputCls} />
            <input name="priceLocal" type="number" step="0.01" placeholder="Precio local" defaultValue={ed ? Number(ed.priceLocal) : ""} required className={inputCls} />
            <input name="platformProductId" placeholder="Producto trigger (dropi_product_id)" defaultValue={ed?.platformProductId ?? ""} className={inputCls} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="active" defaultChecked={ed ? ed.active : true} /> Activa
            </label>
            <button type="submit" className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground">
              {ed ? "Guardar oferta" : "Crear oferta"}
            </button>
            {ed ? (
              <Link href={`/networks?network=${selectedId}`} className="rounded-md border px-3 py-1.5 text-center text-sm hover:bg-muted">
                Cancelar edición
              </Link>
            ) : null}
          </form>

          {/* Búsqueda */}
          <form method="get" className="flex items-center gap-2 border-t pt-4">
            <input type="hidden" name="network" value={selectedId} />
            <input name="q" placeholder="Buscar por nombre / goods_id / producto" defaultValue={sp.q ?? ""} className={cn(inputCls, "flex-1")} />
            <button type="submit" className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted">Buscar</button>
          </form>

          <div className="overflow-x-auto rounded-lg border">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Goods ID</TableHead>
                  <TableHead>País</TableHead>
                  <TableHead className="text-right">Payout</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead>Producto trigger</TableHead>
                  <TableHead>Activa</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {offers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                      Sin ofertas (creá una arriba)
                    </TableCell>
                  </TableRow>
                ) : (
                  offers.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell>{o.name}</TableCell>
                      <TableCell>{o.networkOfferId}</TableCell>
                      <TableCell>{o.country}</TableCell>
                      <TableCell className="text-right">${Number(o.payoutUsd)}</TableCell>
                      <TableCell className="text-right">{Number(o.priceLocal)}</TableCell>
                      <TableCell>{o.platformProductId ?? "—"}</TableCell>
                      <TableCell>{o.active ? "Sí" : "No"}</TableCell>
                      <TableCell className="space-x-1 text-right whitespace-nowrap">
                        <Link href={`/networks?network=${selectedId}&edit=${o.id}`} className="rounded-md border px-2 py-1 text-xs hover:bg-muted">
                          Editar
                        </Link>
                        <form action={deleteOffer} className="inline">
                          <input type="hidden" name="id" value={o.id} />
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
        </CardContent>
      </Card>
    </div>
  );
}
