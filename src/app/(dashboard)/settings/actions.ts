"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/server";
import { prisma } from "@/lib/db";

/** Habilita/deshabilita el push-pending de una red (kill switch). */
export async function setNetworkPush(
  networkId: string,
  enabled: boolean,
): Promise<void> {
  const session = await getSession();
  if (!session) return;
  if (!networkId) return;

  await prisma.network.update({
    where: { id: networkId },
    data: { pushEnabled: enabled },
  });
  revalidatePath("/settings");
}
