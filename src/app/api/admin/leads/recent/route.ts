import { NextResponse } from "next/server";
import type { Platform } from "@prisma/client";
import { isAuthorized } from "@/lib/cron-auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Lista los leads más recientes (JSON) para monitoreo/verificación.
 * Protegido con Bearer CRON_SECRET (bajo /api/admin, fuera de la sesión del dashboard).
 * Query: ?limit=10&platform=landing
 */
export async function GET(req: Request): Promise<Response> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sp = new URL(req.url).searchParams;
  const take = Math.min(50, Math.max(1, Number(sp.get("limit")) || 10));
  const platform = (sp.get("platform") as Platform | null) || undefined;

  const leads = await prisma.lead.findMany({
    where: platform ? { platform } : undefined,
    include: { offer: { select: { name: true, networkOfferId: true } } },
    orderBy: { createdAt: "desc" },
    take,
  });

  return NextResponse.json({
    count: leads.length,
    leads: leads.map((l) => ({
      id: l.id,
      createdAt: l.createdAt,
      platform: l.platform,
      channel: l.channel,
      status: l.status,
      externalId: l.externalId,
      offer: l.offer?.name ?? null,
      sku: l.offer?.networkOfferId ?? null,
      networkLeadId: l.networkLeadId,
      name: l.customerName,
      phone: l.customerPhone,
      city: l.customerCity,
      region: l.customerRegion,
      provinceId: l.customerProvinceId,
      postal: l.customerPostalCode,
      quantity: l.quantity,
      total: l.totalPriceLocal != null ? Number(l.totalPriceLocal) : null,
      email: l.customerEmail,
      ip: l.customerIp,
      fbp: l.fbp ? "✓" : null,
      fbc: l.fbc ? "✓" : null,
      revenueUsd: l.revenueUsd != null ? Number(l.revenueUsd) : null,
    })),
  });
}
