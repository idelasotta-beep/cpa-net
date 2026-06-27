import type { Lead } from "@prisma/client";
import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/cron-auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getNetworkClient } from "@/lib/networks/registry";

export const runtime = "nodejs";
export const maxDuration = 60;

const log = logger.child({ route: "GET /api/jobs/poll-status" });
const BATCH = 500; // límite de la status API de Adcombo por request

export async function GET(req: Request): Promise<Response> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const leads = await prisma.lead.findMany({
      where: {
        status: { in: ["sent_to_network", "hold"] },
        networkLeadId: { not: null },
      },
      include: { offer: { include: { network: true } } },
      orderBy: { sentToNetworkAt: "asc" },
      take: BATCH,
    });

    // Agrupar por red (status API es por red) y mapear networkLeadId -> leads.
    const byNetwork = new Map<string, string[]>(); // slug -> networkLeadIds
    const byNetworkLeadId = new Map<string, Lead[]>();
    for (const lead of leads) {
      const slug = lead.offer?.network.slug;
      if (!slug || !lead.networkLeadId) continue;
      (byNetwork.get(slug) ?? byNetwork.set(slug, []).get(slug)!).push(lead.networkLeadId);
      (byNetworkLeadId.get(lead.networkLeadId) ?? byNetworkLeadId.set(lead.networkLeadId, []).get(lead.networkLeadId)!).push(lead);
    }

    let checked = 0;
    let updated = 0;

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
          if (lead.status === r.status) continue; // sin cambio
          await prisma.lead.update({
            where: { id: lead.id },
            data: {
              status: r.status,
              lastStatusChangeAt: new Date(),
              ...(r.status === "lead" && r.revenueUsd != null
                ? { revenueUsd: r.revenueUsd }
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
        }
      }
    }

    log.info({ candidates: leads.length, checked, updated }, "poll-status terminado");
    return NextResponse.json({ candidates: leads.length, checked, updated });
  } catch (err) {
    log.error(
      { err: err instanceof Error ? { message: err.message, stack: err.stack } : err },
      "poll-status falló",
    );
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
