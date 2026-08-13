import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { mapStatus } from "@/lib/networks/ecomlatam/client";
import { logger } from "@/lib/logger";
import { sendAlert } from "@/lib/notify";

// crypto + DB → runtime Node.
export const runtime = "nodejs";

const log = logger.child({ route: "GET /api/webhooks/ecomlatam/postback" });

function tokenOk(received: string | null): boolean {
  const expected = env.ECOMLATAM_POSTBACK_TOKEN;
  if (!expected) {
    log.warn("ECOMLATAM_POSTBACK_TOKEN no configurado: validación de token omitida");
    return true; // dev local
  }
  if (!received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Postback de EcomLatam (push de estado). Es un GET con variables en la URL:
 *   ?token=<secreto>&leadId={leadId}&status={status}&payout={payout}&clickId={clickId}...
 * Reconcilia por networkLeadId ({leadId}) con fallback a clickId (= lead.id) y
 * actualiza el estado + revenue. Idempotente: si el estado no cambia, no hace nada.
 */
export async function GET(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const q = url.searchParams;

    // 1. Token secreto (el postback va sin HMAC).
    if (!tokenOk(q.get("token"))) {
      log.warn("token de postback inválido");
      return NextResponse.json({ error: "invalid token" }, { status: 401 });
    }

    const leadIdParam = q.get("leadId")?.trim() || null; // networkLeadId de EcomLatam
    const clickId = q.get("clickId")?.trim() || null; // = lead.id (reconciliación)
    const statusRaw = q.get("status")?.trim() || "";
    const payoutRaw = q.get("payout")?.trim() || "";

    const status = mapStatus(statusRaw);
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
    if (!lead && clickId) {
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

    // 4. Revenue: en ventas confirmadas usar el payout del postback (USD); si no
    //    viene, caer al payoutUsd de la oferta (como en poll-status).
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
            note: `EcomLatam postback status="${statusRaw}"${payoutRaw ? ` payout=${payoutRaw}` : ""}`.slice(0, 500),
          },
        },
      },
    });

    log.info({ leadId: lead.id, from: lead.status, to: status, revenue }, "postback aplicado");

    if (status === "lead") {
      const rev = revenue ? ` (+$${revenue.toFixed(2)} USD)` : "";
      await sendAlert("💰 Venta confirmada", `1 venta confirmada por EcomLatam${rev} 🎉`);
    }

    return NextResponse.json({ status: "updated", lead_id: lead.id, new_status: status });
  } catch (err) {
    log.error(
      { err: err instanceof Error ? { message: err.message, stack: err.stack } : err },
      "error inesperado procesando postback de EcomLatam",
    );
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
