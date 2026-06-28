"use server";

import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/server";
import { prisma } from "@/lib/db";

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
