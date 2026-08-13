import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { sendPurchaseEvent } from "@/lib/meta/capi";
import type { CanonicalStatus } from "@/lib/networks/types";
import { sendAlert } from "@/lib/notify";

/**
 * Handler compartido de postbacks de redes CPA "push" (Latinecom, Latinleads, …).
 *
 * Todas pegan a `/api/webhooks/<red>/postback` con GET y las variables como query.
 * Como las URLs las armamos NOSOTROS, normalizamos los nombres de param en la config:
 *   ?token=<secreto>&status=<outcome>&leadId=<networkLeadId>&clickId=<lead.id>&payout=<usd?>
 * Así el handler es idéntico para todas; lo único propio de cada red es el token.
 */

/** Vocabulario de outcomes de las distintas redes → estado canónico. */
export function mapPostbackStatus(status: string): CanonicalStatus | "unknown" {
  switch (status.trim().toLowerCase()) {
    case "sale":
    case "sales":
    case "confirm":
    case "confirmed":
    case "lead":
      return "lead";
    case "hold":
      return "hold";
    case "reject":
    case "rejected":
    case "cancelled":
      return "reject";
    case "trash":
    case "trashed":
      return "trash";
    default:
      return "unknown";
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** lead.id es UUID: evita que un clickId mal formado (ej. data de un test) rompa el findUnique. */
function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

export interface PostbackConfig {
  /** slug de la red (para el log de la ruta). */
  slug: string;
  /** nombre para mostrar en alerta/historial. */
  label: string;
  /** token esperado (env por red). Vacío = validación omitida (dev). */
  expectedToken: string;
}

function tokenOk(
  received: string | null,
  expected: string,
  log: { warn: (msg: string) => void },
): boolean {
  if (!expected) {
    log.warn("token de postback no configurado: validación omitida");
    return true; // dev local
  }
  if (!received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function handleNetworkPostback(
  req: Request,
  cfg: PostbackConfig,
): Promise<Response> {
  const log = logger.child({ route: `GET /api/webhooks/${cfg.slug}/postback` });
  try {
    const q = new URL(req.url).searchParams;

    // 1. Token secreto (el postback va sin HMAC).
    if (!tokenOk(q.get("token"), cfg.expectedToken, log)) {
      log.warn("token de postback inválido");
      return NextResponse.json({ error: "invalid token" }, { status: 401 });
    }

    const leadIdParam = q.get("leadId")?.trim() || null; // networkLeadId
    const clickId = q.get("clickId")?.trim() || null; // = lead.id (reconciliación)
    const statusRaw = q.get("status")?.trim() || "";
    const payoutRaw = q.get("payout")?.trim() || "";

    const status = mapPostbackStatus(statusRaw);
    if (status === "unknown") {
      log.warn({ statusRaw, leadIdParam }, "status de postback no reconocido");
      return NextResponse.json({ status: "ignored", reason: "unknown_status" });
    }

    // 2. Resolver el lead: primero por networkLeadId, luego por clickId (= lead.id).
    let lead =
      leadIdParam != null
        ? await prisma.lead.findFirst({
            where: { networkLeadId: leadIdParam },
            include: { offer: true },
          })
        : null;
    if (!lead && clickId && isUuid(clickId)) {
      lead = await prisma.lead.findUnique({
        where: { id: clickId },
        include: { offer: true },
      });
    }
    if (!lead) {
      log.warn({ leadIdParam, clickId }, "postback sin lead que matchee");
      return NextResponse.json({ status: "ignored", reason: "lead_not_found" });
    }

    // 3. Idempotencia: si el estado no cambia, no tocar.
    if (lead.status === status) {
      return NextResponse.json({ status: "unchanged", lead_id: lead.id });
    }

    // 4. Revenue: en ventas usar el payout del postback (USD); si no viene, caer al
    //    payoutUsd de la oferta (ej. Latinleads no manda payout).
    const payoutNum = Number(payoutRaw);
    const revenue =
      status === "lead"
        ? Number.isFinite(payoutNum) && payoutRaw !== ""
          ? payoutNum
          : lead.offer
            ? Number(lead.offer.payoutUsd)
            : undefined
        : undefined;

    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        status,
        lastStatusChangeAt: new Date(),
        ...(status === "lead" && revenue != null ? { revenueUsd: revenue } : {}),
        statusHistory: {
          create: {
            oldStatus: lead.status,
            newStatus: status,
            source: "postback",
            note: `${cfg.label} postback status="${statusRaw}"${payoutRaw ? ` payout=${payoutRaw}` : ""}`.slice(0, 500),
          },
        },
      },
    });

    log.info({ leadId: lead.id, from: lead.status, to: status, revenue }, "postback aplicado");

    if (status === "lead") {
      const rev = revenue ? ` (+$${revenue.toFixed(2)} USD)` : "";
      await sendAlert("💰 Venta confirmada", `1 venta confirmada por ${cfg.label}${rev} 🎉`);

      // Meta CAPI: solo para leads del funnel de Meta ads (Shopify + Releasit). Para
      // leads de otras plataformas NO disparamos, así no ensuciamos la optimización
      // con conversiones que Meta nunca originó. Best-effort: si falla, no rompe nada.
      if (lead.platform === "shopify") {
        await sendPurchaseEvent({
          eventId: lead.id, // dedup key
          value: revenue ?? 0,
          currency: "USD",
          email: lead.customerEmail,
          phone: lead.customerPhone,
          ip: lead.customerIp,
          externalId: lead.id,
          contentIds: lead.offer ? [lead.offer.networkOfferId] : undefined,
        });
      }
    }

    return NextResponse.json({ status: "updated", lead_id: lead.id, new_status: status });
  } catch (err) {
    log.error(
      { err: err instanceof Error ? { message: err.message, stack: err.stack } : err },
      "error inesperado procesando postback",
    );
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
