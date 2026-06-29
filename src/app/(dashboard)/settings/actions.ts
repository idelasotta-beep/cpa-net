"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { sendAlert } from "@/lib/notify";

/** Envía una alerta de prueba a todos los canales configurados. */
export async function sendTestAlert(): Promise<{ ok: boolean }> {
  const session = await getSession();
  if (!session) return { ok: false };
  await sendAlert(
    "✅ Prueba CPA Net",
    "Alerta de prueba. Si la recibís, las notificaciones están funcionando.",
  );
  return { ok: true };
}

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

/** Configura el reporte diario por Telegram (on/off + hora 0-23 Santiago). */
export async function setDailyReport(
  enabled: boolean,
  hour: number,
): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const h = Math.max(0, Math.min(23, Math.floor(hour)));
  await prisma.appSettings.upsert({
    where: { id: "singleton" },
    update: { dailyReportEnabled: enabled, dailyReportHour: h },
    create: { id: "singleton", dailyReportEnabled: enabled, dailyReportHour: h },
  });
  revalidatePath("/settings");
}
