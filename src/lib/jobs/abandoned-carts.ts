import type { AbandonedCart } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

const log = logger.child({ job: "abandoned-carts" });
const BATCH = 100;
const MAX_ATTEMPTS = 5; // deja de reintentar una URL rota

export interface AbandonedWebhookResult {
  skipped?: string;
  candidates: number;
  sent: number;
  failed: number;
}

async function postWebhook(url: string, token: string | null, cart: AbandonedCart): Promise<boolean> {
  const body = {
    event: "abandoned_cart",
    submitId: cart.submitId,
    landingId: cart.landingId,
    sku: cart.sku,
    countryCode: cart.countryCode,
    name: cart.customerName,
    phone: cart.customerPhone,
    createdAt: cart.createdAt,
    data: cart.payload, // datos parciales completos del form
  };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) log.warn({ status: res.status, submitId: cart.submitId }, "webhook respondió no-2xx");
    return res.ok;
  } catch (e) {
    log.warn({ err: e instanceof Error ? e.message : e, submitId: cart.submitId }, "fallo POST webhook");
    return false;
  }
}

/**
 * Dispara el webhook de carritos abandonados: parciales no recuperados, más viejos que
 * la ventana de gracia. Best-effort por carrito; reintenta hasta MAX_ATTEMPTS. Reusable
 * por el cron y por un botón del dashboard.
 */
export async function runAbandonedCartWebhook(): Promise<AbandonedWebhookResult> {
  const s = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
  if (!s || !s.abandonedWebhookEnabled || !s.abandonedWebhookUrl) {
    return { skipped: "disabled", candidates: 0, sent: 0, failed: 0 };
  }
  const delayMs = Math.max(0, s.abandonedDelayMinutes ?? 20) * 60_000;
  const cutoff = new Date(Date.now() - delayMs);

  const carts = await prisma.abandonedCart.findMany({
    where: {
      recovered: false,
      webhookSentAt: null,
      webhookAttempts: { lt: MAX_ATTEMPTS },
      createdAt: { lt: cutoff },
    },
    orderBy: { createdAt: "asc" },
    take: BATCH,
  });

  let sent = 0;
  let failed = 0;
  for (const c of carts) {
    const ok = await postWebhook(s.abandonedWebhookUrl, s.abandonedWebhookToken, c);
    await prisma.abandonedCart.update({
      where: { id: c.id },
      data: {
        webhookAttempts: { increment: 1 },
        ...(ok ? { webhookSentAt: new Date() } : {}),
      },
    });
    if (ok) sent++;
    else failed++;
  }

  log.info({ candidates: carts.length, sent, failed }, "webhook de carritos abandonados");
  return { candidates: carts.length, sent, failed };
}
