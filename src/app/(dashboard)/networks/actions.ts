"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/server";
import { prisma } from "@/lib/db";

/** Crea (o renombra) una red CPA por slug. */
export async function createNetwork(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  if (!/^[a-z0-9_]+$/.test(slug) || !name) return;

  await prisma.network.upsert({
    where: { slug },
    update: { name },
    create: { slug, name, active: true },
  });
  revalidatePath("/networks");
}

/** Crea/edita una oferta manualmente (upsert por red + networkOfferId). */
export async function upsertOffer(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;

  const networkId = String(formData.get("networkId") ?? "");
  const networkOfferId = String(formData.get("networkOfferId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const country = String(formData.get("country") ?? "").trim().toUpperCase();
  const payoutUsd = Number(formData.get("payoutUsd"));
  const priceLocal = Number(formData.get("priceLocal"));
  const platformProductId =
    String(formData.get("platformProductId") ?? "").trim() || null;
  const active = formData.get("active") === "on";

  if (!networkId || !networkOfferId || !name || !country) return;
  if (Number.isNaN(payoutUsd) || Number.isNaN(priceLocal)) return;

  const data = { name, country, payoutUsd, priceLocal, platformProductId, active };
  await prisma.offer.upsert({
    where: { networkId_networkOfferId: { networkId, networkOfferId } },
    update: data,
    create: { networkId, networkOfferId, ...data },
  });
  revalidatePath("/networks");
}

/** Borra una oferta. */
export async function deleteOffer(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  try {
    await prisma.offer.delete({ where: { id } });
  } catch {
    // Puede fallar si tiene costos asociados (FK restrict). Se ignora.
  }
  revalidatePath("/networks");
}
