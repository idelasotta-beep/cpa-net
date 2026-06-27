import type { LeadSource, LeadStatus } from "@prisma/client";
import Link from "next/link";
import { LeadDrawer, type LeadDetailDTO } from "@/components/lead-drawer";
import { StatusBadge } from "@/components/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatSantiago } from "@/lib/dashboard/dates";
import {
  getLeadDetail,
  getLeadsPage,
  getOffersWithLeads,
} from "@/lib/dashboard/queries";
import {
  ORDERED_STATUSES,
  SOURCE_LABEL,
  STATUS_LABEL,
} from "@/lib/dashboard/status-labels";

export const dynamic = "force-dynamic";

type SP = Record<string, string | undefined>;

function buildQuery(sp: SP, overrides: Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...sp, ...overrides })) {
    if (v) p.set(k, v);
  }
  return p.toString();
}

async function toDetailDTO(id: string): Promise<LeadDetailDTO | null> {
  const d = await getLeadDetail(id);
  if (!d) return null;
  return {
    id: d.id,
    externalId: d.externalId,
    source: d.source,
    status: d.status,
    offerName: d.offer?.name ?? null,
    networkOfferId: d.offer?.networkOfferId ?? null,
    networkLeadId: d.networkLeadId,
    customerName: d.customerName,
    customerPhone: d.customerPhone,
    customerCity: d.customerCity,
    customerRegion: d.customerRegion,
    customerCountry: d.customerCountry,
    revenueUsd: d.revenueUsd == null ? null : Number(d.revenueUsd),
    utmSource: d.utmSource,
    utmCampaign: d.utmCampaign,
    createdAt: formatSantiago(d.createdAt),
    sentToNetworkAt: d.sentToNetworkAt ? formatSantiago(d.sentToNetworkAt) : null,
    rawPayload: d.rawPayload,
    history: d.statusHistory.map((h) => ({
      oldStatus: h.oldStatus,
      newStatus: h.newStatus,
      source: h.source,
      note: h.note,
      changedAt: formatSantiago(h.changedAt),
    })),
  };
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const [result, offers, detail] = await Promise.all([
    getLeadsPage({
      status: sp.status ? [sp.status as LeadStatus] : undefined,
      source: (sp.source as LeadSource) || undefined,
      offerId: sp.offerId || undefined,
      city: sp.city || undefined,
      search: sp.search || undefined,
      page,
    }),
    getOffersWithLeads(),
    sp.lead ? toDetailDTO(sp.lead) : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Leads</h1>

      <form method="get" className="flex flex-wrap items-end gap-2">
        <input
          name="search"
          placeholder="Nombre o teléfono"
          defaultValue={sp.search ?? ""}
          className="rounded-md border bg-background px-2 py-1.5 text-sm"
        />
        <select name="status" defaultValue={sp.status ?? ""} className="rounded-md border bg-background px-2 py-1.5 text-sm">
          <option value="">Todos los estados</option>
          {ORDERED_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
        <select name="source" defaultValue={sp.source ?? ""} className="rounded-md border bg-background px-2 py-1.5 text-sm">
          <option value="">Todos los sources</option>
          <option value="shopify">Shopify</option>
          <option value="whatsapp_ai">WhatsApp</option>
        </select>
        <select name="offerId" defaultValue={sp.offerId ?? ""} className="rounded-md border bg-background px-2 py-1.5 text-sm">
          <option value="">Todas las ofertas</option>
          {offers.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
        <input
          name="city"
          placeholder="Ciudad"
          defaultValue={sp.city ?? ""}
          className="rounded-md border bg-background px-2 py-1.5 text-sm"
        />
        <button type="submit" className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground">
          Filtrar
        </button>
        <Link href="/leads" className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
          Limpiar
        </Link>
      </form>

      <div className="overflow-x-auto rounded-lg border">
        <Table className="min-w-[720px]">
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Oferta</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Ciudad</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  Sin leads
                </TableCell>
              </TableRow>
            ) : (
              result.rows.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="whitespace-nowrap text-xs">{formatSantiago(l.createdAt)}</TableCell>
                  <TableCell>{SOURCE_LABEL[l.source]}</TableCell>
                  <TableCell>{l.offer?.name ?? "—"}</TableCell>
                  <TableCell>
                    <Link href={`/leads?${buildQuery(sp, { lead: l.id })}`} className="font-medium hover:underline">
                      {l.customerName}
                    </Link>
                  </TableCell>
                  <TableCell>{l.customerCity ?? "—"}</TableCell>
                  <TableCell><StatusBadge status={l.status} /></TableCell>
                  <TableCell className="text-right">
                    {l.status === "lead" && l.revenueUsd != null ? `$${Number(l.revenueUsd)}` : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {result.total} leads · página {result.page}/{Math.max(1, result.pages)}
        </span>
        <div className="flex gap-2">
          {page > 1 ? (
            <Link href={`/leads?${buildQuery(sp, { page: String(page - 1), lead: undefined })}`} className="rounded-md border px-3 py-1.5 hover:bg-muted">
              Anterior
            </Link>
          ) : null}
          {page < result.pages ? (
            <Link href={`/leads?${buildQuery(sp, { page: String(page + 1), lead: undefined })}`} className="rounded-md border px-3 py-1.5 hover:bg-muted">
              Siguiente
            </Link>
          ) : null}
        </div>
      </div>

      {detail ? <LeadDrawer detail={detail} /> : null}
    </div>
  );
}
