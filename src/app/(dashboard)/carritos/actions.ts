"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/server";
import { resendCart } from "@/lib/jobs/abandoned-carts";

/** Envía el carrito al webhook en el acto (no espera al cron). */
export async function resendAbandonedCart(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const id = String(formData.get("id") || "");
  if (!id) return;
  await resendCart(id);
  revalidatePath("/carritos");
}
