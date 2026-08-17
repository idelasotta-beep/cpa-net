"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { type ChannelResult, sendAlert } from "@/lib/notify";

/** Configura el email por Resend desde Ajustes (API key se guarda en la base). */
export async function setEmailConfig(
  enabled: boolean,
  apiKey: string,
  to: string,
  from: string,
): Promise<void> {
  const session = await getSession();
  if (!session) return;

  const update: Prisma.AppSettingsUpdateInput = {
    emailEnabled: enabled,
    emailTo: to.trim() || null,
    emailFrom: from.trim() || null,
  };
  // Solo actualiza la API key si se ingresó una nueva (vacío = mantener la actual).
  if (apiKey.trim()) update.resendApiKey = apiKey.trim();

  await prisma.appSettings.upsert({
    where: { id: "singleton" },
    update,
    create: {
      id: "singleton",
      emailEnabled: enabled,
      emailTo: to.trim() || null,
      emailFrom: from.trim() || null,
      resendApiKey: apiKey.trim() || null,
    },
  });
  revalidatePath("/settings");
}

/** Envía una alerta de prueba y devuelve el resultado por canal. */
export async function sendTestAlert(): Promise<{ results: ChannelResult[] }> {
  const session = await getSession();
  if (!session) return { results: [] };
  const results = await sendAlert(
    "✅ Prueba CPA Net",
    "Alerta de prueba. Si la recibís, las notificaciones están funcionando.",
  );
  return { results };
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

/** Configura el webhook de carritos abandonados (on/off + URL + token + delay min). */
export async function setAbandonedWebhook(
  enabled: boolean,
  url: string,
  token: string,
  delayMinutes: number,
): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const delay = Math.max(1, Math.min(1440, Math.floor(delayMinutes) || 20));

  const update: Prisma.AppSettingsUpdateInput = {
    abandonedWebhookEnabled: enabled,
    abandonedWebhookUrl: url.trim() || null,
    abandonedDelayMinutes: delay,
  };
  // El token solo se actualiza si viene no vacío (vacío = mantener el actual).
  if (token.trim()) update.abandonedWebhookToken = token.trim();

  await prisma.appSettings.upsert({
    where: { id: "singleton" },
    update,
    create: {
      id: "singleton",
      abandonedWebhookEnabled: enabled,
      abandonedWebhookUrl: url.trim() || null,
      abandonedWebhookToken: token.trim() || null,
      abandonedDelayMinutes: delay,
    },
  });
  revalidatePath("/settings");
}

/** Dominio de campaña A/B (base de las URLs /exp/<slug>). Se normaliza a scheme+host. */
export async function setCampaignBaseUrl(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const raw = String(formData.get("url") ?? "").trim();
  let base: string | null = null;
  if (raw) {
    try {
      const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
      base = `${u.protocol}//${u.host}`;
    } catch {
      base = null;
    }
  }
  await prisma.appSettings.upsert({
    where: { id: "singleton" },
    update: { campaignBaseUrl: base },
    create: { id: "singleton", campaignBaseUrl: base },
  });
  revalidatePath("/settings");
  revalidatePath("/experimentos");
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
