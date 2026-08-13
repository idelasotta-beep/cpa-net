import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock de Prisma (sin DB real).
const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    offer: { findFirst: vi.fn() },
    lead: { findUnique: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { POST } from "@/app/api/webhooks/shopify/route";

const SECRET = "test-shopify-secret";

const validOrder = {
  id: 7197082386682,
  app_id: 5690175,
  name: "GG1003",
  order_number: 1003,
  email: "cliente@example.com",
  phone: "+5493814572504",
  currency: "ARS",
  total_price: "21990.00",
  note_attributes: [
    { name: "Nombre completo", value: "Prueba Test" },
    { name: "Provincia", value: "Formosa" },
    { name: "IP address", value: "2803:c600::1" },
  ],
  shipping_address: {
    name: "Prueba Test",
    address1: "Ramón Cruz Montt",
    address2: "2137",
    city: "Campo Rigonato",
    zip: "3606",
    province: "Formosa",
    province_code: "P",
    country: "Argentina",
    phone: "+5493814572504",
  },
  line_items: [{ sku: "SKU-P90", quantity: 1, price: "21990.00" }],
};

function sign(raw: string): string {
  return createHmac("sha256", SECRET).update(raw, "utf8").digest("base64");
}

function makeReq(raw: string, opts: { signature?: string | null } = {}): Request {
  const headers = new Headers({ "content-type": "application/json" });
  const sig = opts.signature === undefined ? sign(raw) : opts.signature;
  if (sig !== null) headers.set("x-shopify-hmac-sha256", sig);
  return new Request("http://localhost/api/webhooks/shopify", {
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

describe("POST /api/webhooks/shopify", () => {
  it("happy path: crea el lead con dirección estructurada y devuelve 200", async () => {
    const res = await POST(makeReq(JSON.stringify(validOrder)));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      status: "created",
      lead_id: "lead-1",
    });
    const arg = prismaMock.lead.create.mock.calls[0]![0];
    expect(arg.data).toMatchObject({
      externalId: "7197082386682",
      platform: "shopify",
      channel: "shopify",
      offerId: "offer-1",
      customerName: "Prueba Test",
      customerPhone: "5493814572504",
      customerStreet: "Ramón Cruz Montt",
      customerStreetNumber: "2137",
      customerProvinceId: 9,
      customerIp: "2803:c600::1",
      quantity: 1,
      totalPriceLocal: 21990,
    });
  });

  it("idempotencia: si ya existe, no crea y devuelve duplicate", async () => {
    prismaMock.lead.findUnique.mockResolvedValue({ id: "lead-existente" });
    const res = await POST(makeReq(JSON.stringify(validOrder)));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      status: "duplicate",
      lead_id: "lead-existente",
    });
    expect(prismaMock.lead.create).not.toHaveBeenCalled();
  });

  it("auth: rechaza 401 si falta la firma", async () => {
    const res = await POST(makeReq(JSON.stringify(validOrder), { signature: null }));
    expect(res.status).toBe(401);
    expect(prismaMock.lead.create).not.toHaveBeenCalled();
  });

  it("auth: rechaza 401 si la firma es inválida", async () => {
    const res = await POST(
      makeReq(JSON.stringify(validOrder), { signature: "ZGVhZGJlZWY=" }),
    );
    expect(res.status).toBe(401);
  });

  it("rechaza 400 si el body no es JSON", async () => {
    const res = await POST(makeReq("no soy json", { signature: sign("no soy json") }));
    expect(res.status).toBe(400);
  });

  it("rechaza 400 si el payload no cumple el schema (sin id)", async () => {
    const raw = JSON.stringify({ email: "x@y.com" });
    const res = await POST(makeReq(raw, { signature: sign(raw) }));
    expect(res.status).toBe(400);
    expect(prismaMock.lead.create).not.toHaveBeenCalled();
  });

  it("producto sin oferta mapeada: crea el lead con offerId null", async () => {
    prismaMock.offer.findFirst.mockResolvedValue(null);
    const res = await POST(makeReq(JSON.stringify(validOrder)));
    expect(res.status).toBe(200);
    const arg = prismaMock.lead.create.mock.calls[0]![0];
    expect(arg.data.offerId).toBeNull();
  });

  it("orden sin nombre: ignora (200) sin crear lead", async () => {
    const raw = JSON.stringify({
      ...validOrder,
      shipping_address: { province_code: "P", phone: "+5493814572504" },
      note_attributes: [],
    });
    const res = await POST(makeReq(raw, { signature: sign(raw) }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ status: "ignored" });
    expect(prismaMock.lead.create).not.toHaveBeenCalled();
  });
});
