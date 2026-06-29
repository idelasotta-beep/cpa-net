import type { LeadSource, LeadStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/server";
import { formatSantiago } from "@/lib/dashboard/dates";
import { getLeadsForExport } from "@/lib/dashboard/queries";
import { SOURCE_LABEL, STATUS_LABEL } from "@/lib/dashboard/status-labels";

export const runtime = "nodejs";

const COLUMNS = [
  "Fecha",
  "External ID",
  "Source",
  "Estado",
  "Oferta",
  "Offer ID red",
  "Order ID red",
  "Nombre",
  "Teléfono",
  "Dirección",
  "Ciudad",
  "Región",
  "País",
  "Revenue USD",
  "utm_source",
  "utm_campaign",
];

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(req: Request): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sp = new URL(req.url).searchParams;
  const leads = await getLeadsForExport({
    status: sp.get("status") ? [sp.get("status") as LeadStatus] : undefined,
    source: (sp.get("source") as LeadSource) || undefined,
    offerId: sp.get("offerId") || undefined,
    city: sp.get("city") || undefined,
    search: sp.get("search") || undefined,
  });

  const rows = leads.map((l) =>
    [
      formatSantiago(l.createdAt),
      l.externalId,
      SOURCE_LABEL[l.source] ?? l.source,
      STATUS_LABEL[l.status],
      l.offer?.name ?? "",
      l.offer?.networkOfferId ?? "",
      l.networkLeadId ?? "",
      l.customerName,
      l.customerPhone,
      l.customerAddress ?? "",
      l.customerCity ?? "",
      l.customerRegion ?? "",
      l.customerCountry,
      l.revenueUsd != null ? Number(l.revenueUsd) : "",
      l.utmSource ?? "",
      l.utmCampaign ?? "",
    ]
      .map(csvCell)
      .join(","),
  );

  // BOM para que Excel respete UTF-8 (acentos).
  const csv = "﻿" + [COLUMNS.map(csvCell).join(","), ...rows].join("\r\n");
  const date = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="leads-${date}.csv"`,
    },
  });
}
