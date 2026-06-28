"use server";

import { randomUUID } from "node:crypto";
import type { LeadStatus, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/server";
import { prisma } from "@/lib/db";

function nullable(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

function safeReturn(v: FormDataEntryValue | null): string {
  const s = String(v ?? "");
  return s.startsWith("/leads") ? s : "/leads";
}

export interface ManualLeadState {
  error?: string;
  ok?: boolean;
}

export async function createManualLead(
  _prev: ManualLeadState,
  formData: FormData,
): Promise<ManualLeadState> {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  const offerId = String(formData.get("offerId") ?? "");
  const customerName = String(formData.get("customerName") ?? "").trim();
  const customerPhone = String(formData.get("customerPhone") ?? "").trim();
  const customerAddress = String(formData.get("customerAddress") ?? "").trim() || null;
  const customerCity = String(formData.get("customerCity") ?? "").trim() || null;
  const customerRegion = String(formData.get("customerRegion") ?? "").trim() || null;
  const utmCampaign = String(formData.get("utmCampaign") ?? "").trim() || null;

  if (!offerId || !customerName || !customerPhone) {
    return { error: "Oferta, nombre y teléfono son obligatorios" };
  }

  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    select: { id: true, country: true },
  });
  if (!offer) return { error: "Oferta no encontrada" };

  const rawPayload: Prisma.InputJsonValue = {
    manual: true,
    createdBy: session.email,
    createdAt: new Date().toISOString(),
    customerName,
    customerPhone,
    customerAddress,
    customerCity,
    customerRegion,
    utmCampaign,
  };

  await prisma.lead.create({
    data: {
      externalId: `MANUAL-${randomUUID()}`,
      source: "manual",
      offerId: offer.id,
      status: "pending",
      customerName,
      customerPhone,
      customerAddress,
      customerCity,
      customerRegion,
      customerCountry: offer.country,
      utmCampaign,
      rawPayload,
      statusHistory: {
        create: {
          newStatus: "pending",
          source: "manual",
          note: `creado manualmente por ${session.email}`,
        },
      },
    },
  });

  revalidatePath("/leads");
  return { ok: true };
}

/** Edita los campos de un lead. Si cambia el status, registra historial. */
export async function updateLead(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const current = await prisma.lead.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!current) return;

  const customerName = String(formData.get("customerName") ?? "").trim();
  const customerPhone = String(formData.get("customerPhone") ?? "").trim();
  const customerCountry = String(formData.get("customerCountry") ?? "").trim();
  const offerId = nullable(formData.get("offerId"));
  const newStatus = (String(formData.get("status") ?? current.status) || current.status) as LeadStatus;

  if (!customerName || !customerPhone || !customerCountry) return;

  const statusChanged = newStatus !== current.status;

  const data: Prisma.LeadUpdateInput = {
    customerName,
    customerPhone,
    customerCountry,
    customerAddress: nullable(formData.get("customerAddress")),
    customerCity: nullable(formData.get("customerCity")),
    customerRegion: nullable(formData.get("customerRegion")),
    utmSource: nullable(formData.get("utmSource")),
    utmCampaign: nullable(formData.get("utmCampaign")),
    utmContent: nullable(formData.get("utmContent")),
    utmTerm: nullable(formData.get("utmTerm")),
    clickId: nullable(formData.get("clickId")),
    offer: offerId ? { connect: { id: offerId } } : { disconnect: true },
    status: newStatus,
    ...(statusChanged
      ? {
          lastStatusChangeAt: new Date(),
          statusHistory: {
            create: {
              oldStatus: current.status,
              newStatus,
              source: "manual",
              note: `editado por ${session.email}`,
            },
          },
        }
      : {}),
  };

  await prisma.lead.update({ where: { id }, data });
  revalidatePath("/leads");
  redirect(safeReturn(formData.get("returnTo")));
}

/** Borra un lead (y su historial por cascade). */
export async function deleteLead(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.lead.delete({ where: { id } });
  revalidatePath("/leads");
  redirect(safeReturn(formData.get("returnTo")));
}
