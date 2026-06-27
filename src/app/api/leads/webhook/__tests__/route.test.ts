import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock de Prisma (sin DB real). vi.hoisted para poder referenciarlo en vi.mock.
const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    offer: { findFirst: vi.fn() },
    lead: { findUnique: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { POST } from "@/app/api/leads/webhook/route";

const SECRET = "test-secret";

const validPayload = {
  event: "order.created",
  store: { slug: "teleserve", name: "Teleserve", country: "CL" },
  order: {
    number: "ORD-0002",
    created_via: "shopify",
    currency: "CLP",
    total: 24990,
    utm_source: "shopify",
    customer: {
      name: "Test 5",
      surname: "Prueba",
      phone: "+56992498360",
      email: "x@y.com",
    },
    shipping_city: "LA FLORIDA",
    shipping_state: "Santiago",
    items: [
      {
        product_name: "Fresh Deos Natural",
        quantity: 1,
        unit_price: 24990,
        total_price: 24990,
        dropi_product_id: "56579",
      },
    ],
  },
};

function sign(raw: string): string {
  return createHmac("sha256", SECRET).update(raw, "utf8").digest("hex");
}

function makeReq(
  raw: string,
  opts: { signature?: string | null } = {},
): Request {
  const headers = new Headers({ "content-type": "application/json" });
  const sig = opts.signature === undefined ? `sha256=${sign(raw)}` : opts.signature;
  if (sig !== null) headers.set("x-estrategas-signature", sig);
  return new Request("http://localhost/api/leads/webhook", {
    method: "POST",
    body: raw,
    headers,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.offer.findFirst.mockResolvedValue({ id: "offer-1" });
  prismaMock.lead.findUnique.mockResolvedValue(null);
  prismaMock.lead.create.mockResolvedValue({ id: "lead-1" });
});

describe("POST /api/leads/webhook", () => {
  it("happy path: crea el lead y devuelve 200", async () => {
    const res = await POST(makeReq(JSON.stringify(validPayload)));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      status: "created",
      lead_id: "lead-1",
    });
    expect(prismaMock.lead.create).toHaveBeenCalledOnce();
    const arg = prismaMock.lead.create.mock.calls[0]![0];
    expect(arg.data).toMatchObject({
      externalId: "ORD-0002",
      source: "shopify",
      offerId: "offer-1",
      customerName: "Test 5 Prueba",
    });
  });

  it("idempotencia: si ya existe, no crea y devuelve duplicate", async () => {
    prismaMock.lead.findUnique.mockResolvedValue({ id: "lead-existente" });
    const res = await POST(makeReq(JSON.stringify(validPayload)));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      status: "duplicate",
      lead_id: "lead-existente",
    });
    expect(prismaMock.lead.create).not.toHaveBeenCalled();
  });

  it("auth: rechaza 401 si falta la firma", async () => {
    const res = await POST(
      makeReq(JSON.stringify(validPayload), { signature: null }),
    );
    expect(res.status).toBe(401);
    expect(prismaMock.lead.create).not.toHaveBeenCalled();
  });

  it("auth: rechaza 401 si la firma es inválida", async () => {
    const res = await POST(
      makeReq(JSON.stringify(validPayload), { signature: "sha256=deadbeef" }),
    );
    expect(res.status).toBe(401);
  });

  it("rechaza 400 si el body no es JSON", async () => {
    const raw = "no soy json";
    const res = await POST(makeReq(raw, { signature: `sha256=${sign(raw)}` }));
    expect(res.status).toBe(400);
  });

  it("rechaza 400 si el payload no cumple el schema", async () => {
    const raw = JSON.stringify({ event: "order.created", store: { country: "CL" } });
    const res = await POST(makeReq(raw, { signature: `sha256=${sign(raw)}` }));
    expect(res.status).toBe(400);
    expect(prismaMock.lead.create).not.toHaveBeenCalled();
  });

  it("ignora (200) eventos que no son order.created sin crear lead", async () => {
    const raw = JSON.stringify({ ...validPayload, event: "order.updated" });
    const res = await POST(makeReq(raw, { signature: `sha256=${sign(raw)}` }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ status: "ignored" });
    expect(prismaMock.lead.create).not.toHaveBeenCalled();
  });

  it("producto sin oferta mapeada: crea el lead con offerId null", async () => {
    prismaMock.offer.findFirst.mockResolvedValue(null);
    const res = await POST(makeReq(JSON.stringify(validPayload)));
    expect(res.status).toBe(200);
    const arg = prismaMock.lead.create.mock.calls[0]![0];
    expect(arg.data.offerId).toBeNull();
  });

  it("created_via desconocido: ignora (200) sin crear lead", async () => {
    const raw = JSON.stringify({
      ...validPayload,
      order: { ...validPayload.order, created_via: "tiktok" },
    });
    const res = await POST(makeReq(raw, { signature: `sha256=${sign(raw)}` }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ status: "ignored" });
    expect(prismaMock.lead.create).not.toHaveBeenCalled();
  });
});
