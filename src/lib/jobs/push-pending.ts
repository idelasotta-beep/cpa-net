import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { logger, maskPhone } from "@/lib/logger";
import { getNetworkClient } from "@/lib/networks/registry";
import { sendAlert } from "@/lib/notify";

const log = logger.child({ job: "push-pending" });
const BATCH = 50;
const DELAY_MS = 200;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface PushPendingResult {
  processed: number;
  ok: number;
  failed: number;
  skipped: number;
}

/**
 * Envía los leads pendientes a su red (solo redes activas con pushEnabled).
 * Reutilizable por el cron y por el botón "Enviar ahora". Avisa por Telegram si
 * algún lead queda en `failed`.
 */
export async function runPushPending(): Promise<PushPendingResult> {
  const leads = await prisma.lead.findMany({
    where: {
      status: "pending",
      offerId: { not: null },
      pushAttempts: { lt: env.MAX_PUSH_ATTEMPTS },
      offer: { network: { is: { active: true, pushEnabled: true } } },
    },
    include: { offer: { include: { network: true } } },
    orderBy: { createdAt: "asc" },
    take: BATCH,
  });

  let ok = 0;
  let failed = 0;
  let skipped = 0;

  for (const lead of leads) {
    const offer = lead.offer;
    if (!offer || !offer.network.active) {
      skipped++;
      continue;
    }
    const client = getNetworkClient(offer.network.slug);
    if (!client) {
      skipped++;
      log.warn({ slug: offer.network.slug }, "sin client para la red");
      continue;
    }

    const result = await client.createOrder(lead, offer);
    const newAttempts = lead.pushAttempts + 1;

    if (result.ok) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          status: "sent_to_network",
          sentToNetworkAt: new Date(),
          networkLeadId: result.networkLeadId,
          pushAttempts: newAttempts,
          lastPushError: null,
          lastStatusChangeAt: new Date(),
          statusHistory: {
            create: {
              oldStatus: "pending",
              newStatus: "sent_to_network",
              source: "system",
              note: result.isDouble ? "is_double=true" : null,
            },
          },
        },
      });
      ok++;
      log.info(
        { leadId: lead.id, phone: maskPhone(lead.customerPhone), networkLeadId: result.networkLeadId },
        "lead enviado",
      );
    } else {
      const isFailed = newAttempts >= env.MAX_PUSH_ATTEMPTS;
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          pushAttempts: newAttempts,
          lastPushError: result.error ?? "error desconocido",
          ...(isFailed
            ? {
                status: "failed",
                lastStatusChangeAt: new Date(),
                statusHistory: {
                  create: {
                    oldStatus: "pending",
                    newStatus: "failed",
                    source: "system",
                    note: `push falló tras ${newAttempts} intentos: ${result.error ?? ""}`.slice(0, 500),
                  },
                },
              }
            : {}),
        },
      });
      if (isFailed) failed++;
      log.warn({ leadId: lead.id, attempts: newAttempts, error: result.error, isFailed }, "push con error");
    }

    await sleep(DELAY_MS);
  }

  log.info({ processed: leads.length, ok, failed, skipped }, "push-pending terminado");

  if (failed > 0) {
    await sendAlert(
      "⚠️ Leads fallidos",
      `${failed} lead(s) fallaron el envío a la red (agotaron los reintentos). Revisalos en el dashboard (filtro estado "Falló").`,
    );
  }

  return { processed: leads.length, ok, failed, skipped };
}
