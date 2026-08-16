"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/server";
import { prisma } from "@/lib/db";

/** Reencola un carrito para que el cron vuelva a disparar el webhook. */
export async function resendAbandonedCart(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const id = String(formData.get("id") || "");
  if (!id) return;
  await prisma.abandonedCart.updateMany({
    where: { id, recovered: false },
    data: { webhookSentAt: null, webhookAttempts: 0, abandonedAt: new Date() },
  });
  revalidatePath("/carritos");
}
