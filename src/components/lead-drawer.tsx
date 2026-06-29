"use client";

import type { LeadStatus } from "@prisma/client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { deleteLead, retryLead, updateLead } from "@/app/(dashboard)/leads/actions";
import type { OfferOption } from "@/components/manual-lead-dialog";
import { StatusBadge } from "@/components/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  ORDERED_STATUSES,
  SOURCE_LABEL,
  STATUS_LABEL,
} from "@/lib/dashboard/status-labels";

export interface LeadHistoryDTO {
  oldStatus: LeadStatus | null;
  newStatus: LeadStatus;
  source: string;
  note: string | null;
  changedAt: string;
}

export interface LeadDetailDTO {
  id: string;
  externalId: string;
  source: keyof typeof SOURCE_LABEL;
  status: LeadStatus;
  offerId: string | null;
  offerName: string | null;
  networkOfferId: string | null;
  networkLeadId: string | null;
  customerName: string;
  customerPhone: string;
  customerAddress: string | null;
  customerCity: string | null;
  customerRegion: string | null;
  customerCountry: string;
  revenueUsd: number | null;
  clickId: string | null;
  utmSource: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  pushAttempts: number;
  lastPushError: string | null;
  createdAt: string;
  sentToNetworkAt: string | null;
  lastStatusChangeAt: string;
  rawPayload: unknown;
  history: LeadHistoryDTO[];
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-all text-right">{value || "—"}</span>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  required?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={name} className="text-xs">{label}</Label>
      <Input id={name} name={name} defaultValue={defaultValue ?? ""} required={required} />
    </div>
  );
}

export function LeadDrawer({
  detail,
  offers,
}: {
  detail: LeadDetailDTO;
  offers: OfferOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const editing = sp.get("edit") === "1";

  function urlWith(changes: Record<string, string | null>): string {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    const qs = p.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  const viewUrl = urlWith({ edit: null });
  const editUrl = urlWith({ edit: "1" });
  const closeUrl = urlWith({ edit: null, lead: null });

  return (
    <Sheet open onOpenChange={(o) => !o && router.push(closeUrl)}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{detail.customerName}</SheetTitle>
          <SheetDescription>
            {detail.externalId} · <StatusBadge status={detail.status} />
          </SheetDescription>
        </SheetHeader>

        {editing ? (
          <form action={updateLead} className="space-y-4 px-4 pb-8">
            <input type="hidden" name="id" value={detail.id} />
            <input type="hidden" name="returnTo" value={viewUrl} />

            <div className="space-y-1">
              <Label htmlFor="offerId" className="text-xs">Oferta</Label>
              <select
                id="offerId"
                name="offerId"
                defaultValue={detail.offerId ?? ""}
                className="w-full rounded-md border bg-background px-2 py-2 text-sm"
              >
                <option value="">— Sin oferta —</option>
                {offers.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} ({o.country}) · {o.network.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="status" className="text-xs">Estado</Label>
              <select
                id="status"
                name="status"
                defaultValue={detail.status}
                className="w-full rounded-md border bg-background px-2 py-2 text-sm"
              >
                {ORDERED_STATUSES.map((s) => (
                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Nombre" name="customerName" defaultValue={detail.customerName} required />
              <Field label="Teléfono" name="customerPhone" defaultValue={detail.customerPhone} required />
              <Field label="País (ISO2)" name="customerCountry" defaultValue={detail.customerCountry} required />
              <Field label="Ciudad" name="customerCity" defaultValue={detail.customerCity} />
              <Field label="Región" name="customerRegion" defaultValue={detail.customerRegion} />
            </div>
            <Field label="Dirección" name="customerAddress" defaultValue={detail.customerAddress} />

            <div className="grid grid-cols-2 gap-3">
              <Field label="click_id" name="clickId" defaultValue={detail.clickId} />
              <Field label="utm_source" name="utmSource" defaultValue={detail.utmSource} />
              <Field label="utm_campaign" name="utmCampaign" defaultValue={detail.utmCampaign} />
              <Field label="utm_content" name="utmContent" defaultValue={detail.utmContent} />
              <Field label="utm_term" name="utmTerm" defaultValue={detail.utmTerm} />
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" className="flex-1">Guardar</Button>
              <Link href={viewUrl} className={cn(buttonVariants({ variant: "outline" }), "flex-1")}>
                Cancelar
              </Link>
            </div>
          </form>
        ) : (
          <div className="space-y-6 px-4 pb-8">
            {detail.status === "failed" ? (
              <form action={retryLead}>
                <input type="hidden" name="id" value={detail.id} />
                <input type="hidden" name="returnTo" value={viewUrl} />
                <Button type="submit" className="w-full">
                  Reintentar envío
                </Button>
                {detail.lastPushError ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Último error: {detail.lastPushError}
                  </p>
                ) : null}
              </form>
            ) : null}

            <div className="flex gap-2">
              <Link href={editUrl} className={cn(buttonVariants({ size: "sm" }), "flex-1")}>
                Editar
              </Link>
              <form action={deleteLead} className="flex-1">
                <input type="hidden" name="id" value={detail.id} />
                <input type="hidden" name="returnTo" value={closeUrl} />
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  className="w-full text-destructive"
                  onClick={(e) => {
                    if (!confirm("¿Borrar este lead? No se puede deshacer.")) e.preventDefault();
                  }}
                >
                  Borrar
                </Button>
              </form>
            </div>

            <section>
              <h3 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Cliente</h3>
              <Row label="Teléfono" value={detail.customerPhone} />
              <Row label="Dirección" value={detail.customerAddress} />
              <Row label="Ciudad" value={detail.customerCity} />
              <Row label="Región" value={detail.customerRegion} />
              <Row label="País" value={detail.customerCountry} />
            </section>

            <section>
              <h3 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Oferta / Red</h3>
              <Row label="Oferta" value={detail.offerName} />
              <Row label="Offer ID (red)" value={detail.networkOfferId} />
              <Row label="Order ID (red)" value={detail.networkLeadId} />
              <Row label="Source" value={SOURCE_LABEL[detail.source] ?? detail.source} />
              <Row label="Estado" value={STATUS_LABEL[detail.status]} />
              <Row label="Revenue" value={detail.revenueUsd != null ? `$${detail.revenueUsd}` : "—"} />
            </section>

            <section>
              <h3 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Tracking</h3>
              <Row label="click_id" value={detail.clickId} />
              <Row label="utm_source" value={detail.utmSource} />
              <Row label="utm_campaign" value={detail.utmCampaign} />
              <Row label="utm_content" value={detail.utmContent} />
              <Row label="utm_term" value={detail.utmTerm} />
            </section>

            <section>
              <h3 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Sistema</h3>
              <Row label="external_id" value={detail.externalId} />
              <Row label="Creado" value={detail.createdAt} />
              <Row label="Enviado a la red" value={detail.sentToNetworkAt} />
              <Row label="Último cambio" value={detail.lastStatusChangeAt} />
              <Row label="Intentos de envío" value={String(detail.pushAttempts)} />
              <Row label="Último error" value={detail.lastPushError} />
            </section>

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Historial</h3>
              <ul className="space-y-2">
                {detail.history.map((h, i) => (
                  <li key={i} className="rounded border p-2 text-sm">
                    <div className="flex justify-between">
                      <span>
                        {h.oldStatus ? `${STATUS_LABEL[h.oldStatus]} → ` : ""}
                        <strong>{STATUS_LABEL[h.newStatus]}</strong>
                      </span>
                      <span className="text-xs text-muted-foreground">{h.changedAt}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {h.source}
                      {h.note ? ` · ${h.note}` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">raw_payload</h3>
              <pre className="max-h-72 overflow-auto rounded bg-muted p-2 text-[11px]">
                {JSON.stringify(detail.rawPayload, null, 2)}
              </pre>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
