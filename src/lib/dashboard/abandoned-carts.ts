import { prisma } from "@/lib/db";

export type CartStatus = "recovered" | "sent" | "pending";

export interface CartRow {
  id: string;
  createdAt: Date;
  name: string | null;
  phone: string | null;
  landingId: string | null;
  sku: string | null;
  offer: string | null; // resuelto por SKU contra el catálogo de ofertas
  network: string | null;
  countryCode: string | null;
  status: CartStatus;
}

export interface AbandonedCartsResult {
  rows: CartRow[];
  counts: { total: number; pending: number; sent: number; recovered: number };
}

function statusOf(c: { recovered: boolean; webhookSentAt: Date | null }): CartStatus {
  if (c.recovered) return "recovered";
  return c.webhookSentAt ? "sent" : "pending";
}

export async function getAbandonedCarts({
  from,
  to,
  status,
}: {
  from: Date;
  to: Date;
  status?: string | null;
}): Promise<AbandonedCartsResult> {
  const carts = await prisma.abandonedCart.findMany({
    where: { createdAt: { gte: from, lt: to } },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true,
      createdAt: true,
      customerName: true,
      customerPhone: true,
      landingId: true,
      sku: true,
      countryCode: true,
      recovered: true,
      webhookSentAt: true,
    },
  });

  // Resolver oferta + red por SKU (como el intake), para mostrarlas en la lista.
  const skus = [...new Set(carts.map((c) => c.sku).filter((s): s is string => Boolean(s)))];
  const offers = skus.length
    ? await prisma.offer.findMany({
        where: { platformProductId: { in: skus }, active: true },
        select: { platformProductId: true, name: true, network: { select: { name: true } } },
      })
    : [];
  const offerBySku = new Map<string, { name: string; network: string }>();
  for (const o of offers) {
    if (o.platformProductId && !offerBySku.has(o.platformProductId)) {
      offerBySku.set(o.platformProductId, { name: o.name, network: o.network.name });
    }
  }

  const all: CartRow[] = carts.map((c) => {
    const off = c.sku ? offerBySku.get(c.sku) : undefined;
    return {
      id: c.id,
      createdAt: c.createdAt,
      name: c.customerName,
      phone: c.customerPhone,
      landingId: c.landingId,
      sku: c.sku,
      offer: off?.name ?? null,
      network: off?.network ?? null,
      countryCode: c.countryCode,
      status: statusOf(c),
    };
  });

  const counts = {
    total: all.length,
    pending: all.filter((r) => r.status === "pending").length,
    sent: all.filter((r) => r.status === "sent").length,
    recovered: all.filter((r) => r.status === "recovered").length,
  };

  const rows = status && status !== "all" ? all.filter((r) => r.status === status) : all;
  return { rows, counts };
}
