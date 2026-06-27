"use client";

import type { LeadStatus } from "@prisma/client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { SOURCE_LABEL, STATUS_LABEL } from "@/lib/dashboard/status-labels";

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
  offerName: string | null;
  networkOfferId: string | null;
  networkLeadId: string | null;
  customerName: string;
  customerPhone: string;
  customerCity: string | null;
  customerRegion: string | null;
  customerCountry: string;
  revenueUsd: number | null;
  utmSource: string | null;
  utmCampaign: string | null;
  createdAt: string;
  sentToNetworkAt: string | null;
  rawPayload: unknown;
  history: LeadHistoryDTO[];
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value || "—"}</span>
    </div>
  );
}

export function LeadDrawer({ detail }: { detail: LeadDetailDTO }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function close() {
    const p = new URLSearchParams(sp.toString());
    p.delete("lead");
    router.push(`${pathname}?${p.toString()}`);
  }

  return (
    <Sheet open onOpenChange={(o) => !o && close()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{detail.customerName}</SheetTitle>
          <SheetDescription>
            {detail.externalId} · <StatusBadge status={detail.status} />
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-4 pb-8">
          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Cliente</h3>
            <Row label="Teléfono" value={detail.customerPhone} />
            <Row label="Ciudad" value={detail.customerCity} />
            <Row label="Región" value={detail.customerRegion} />
            <Row label="País" value={detail.customerCountry} />
          </section>

          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Oferta / Red</h3>
            <Row label="Oferta" value={detail.offerName} />
            <Row label="Adcombo offer" value={detail.networkOfferId} />
            <Row label="Order ID (red)" value={detail.networkLeadId} />
            <Row label="Source" value={SOURCE_LABEL[detail.source] ?? detail.source} />
            <Row label="Revenue" value={detail.revenueUsd != null ? `$${detail.revenueUsd}` : "—"} />
            <Row label="UTM campaign" value={detail.utmCampaign} />
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
      </SheetContent>
    </Sheet>
  );
}
