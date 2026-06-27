"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

export async function upsertCost(formData: FormData): Promise<void> {
  const offerId = String(formData.get("offerId") ?? "");
  const dateStr = String(formData.get("date") ?? "");
  const amountUsd = Number(formData.get("amountUsd"));
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!offerId || !dateStr || Number.isNaN(amountUsd)) return;
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return;

  await prisma.dailyCost.upsert({
    where: { offerId_date: { offerId, date } },
    update: { amountUsd, notes },
    create: { offerId, date, amountUsd, notes },
  });
  revalidatePath("/costs");
}

export async function deleteCost(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.dailyCost.delete({ where: { id } });
  revalidatePath("/costs");
}
