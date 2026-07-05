import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getNetworkClient } from "@/lib/networks/registry";
import { sendAlert } from "@/lib/notify";

type LeadWithOffer = Prisma.LeadGetPayload<{
  include: { offer: { include: { network: true } } };
}>;

const log = logger.child({ job: "poll-status" });
const BATCH = 500; // límite de la status API de Adcombo por request

export interface PollStatusResult {
  candidates: number;
  checked: number;
  updated: number;
}

/**
 * Consulta el estado de los leads en vuelo (sent_to_network / hold) contra cada red
 * y actualiza los que cambiaron. Reutilizable por el cron y por el botón del dashboard.
 */
export async function runPollStatus(): Promise<PollStatusResult> {
  const leads = await prisma.lead.findMany({
    where: {
      status: { in: ["sent_to_network", "hold"] },
      networkLeadId: { not: null },
    },
    include: { offer: { include: { network: true } } },
    orderBy: { sentToNetworkAt: "asc" },
    take: BATCH,
  });

  const byNetwork = new Map<string, string[]>(); // slug -> networkLeadIds
  const byNetworkLeadId = new Map<string, LeadWithOffer[]>();
  for (const lead of leads) {
    const slug = lead.offer?.network.slug;
    if (!slug || !lead.networkLeadId) continue;
    (byNetwork.get(slug) ?? byNetwork.set(slug, []).get(slug)!).push(lead.networkLeadId);
    (byNetworkLeadId.get(lead.networkLeadId) ?? byNetworkLeadId.set(lead.networkLeadId, []).get(lead.networkLeadId)!).push(lead);
  }

  let checked = 0;
  let updated = 0;
  let confirmed = 0;
  let confirmedRevenue = 0;

  for (const [slug, ids] of byNetwork) {
    const client = getNetworkClient(slug);
    if (!client) {
      log.warn({ slug }, "sin client para la red");
      continue;
    }
    const results = await client.fetchStatuses(ids);
    checked += results.length;

    for (const r of results) {
      if (r.status === "unknown") continue;
      const matched = byNetworkLeadId.get(r.networkLeadId) ?? [];
      for (const lead of matched) {
        if (lead.status === r.status) continue;
        // Revenue: si la red no lo devuelve (ej. Latinleads), usar el payout de la oferta.
        const revenue =
          r.revenueUsd ?? (lead.offer ? Number(lead.offer.payoutUsd) : undefined);
        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            status: r.status,
            lastStatusChangeAt: new Date(),
            ...(r.status === "lead" && revenue != null
              ? { revenueUsd: revenue }
              : {}),
            statusHistory: {
              create: {
                oldStatus: lead.status,
                newStatus: r.status,
                source: "polling",
                note: r.note?.slice(0, 500) ?? null,
              },
            },
          },
        });
        updated++;
        if (r.status === "lead") {
          confirmed++;
          confirmedRevenue += revenue ?? 0;
        }
      }
    }
  }

  log.info({ candidates: leads.length, checked, updated, confirmed }, "poll-status terminado");

  if (confirmed > 0) {
    const rev = confirmedRevenue ? ` (+$${confirmedRevenue.toFixed(2)} USD)` : "";
    await sendAlert("💰 Ventas confirmadas", `${confirmed} venta(s) confirmada(s)${rev} 🎉`);
  }

  return { candidates: leads.length, checked, updated };
}
