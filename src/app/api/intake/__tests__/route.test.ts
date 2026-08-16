import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    offer: { findFirst: vi.fn() },
    lead: { findUnique: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { OPTIONS, POST } from "@/app/api/intake/route";

const validPayload = {
  submitId: "22222222-2222-2222-2222-222222222222",
  sku: "SKU-P90",
  quantity: 2,
  totalPriceLocal: 98569,
  name: "Prueba Test",
  phone: "+54 9 11 3442 2920",
  email: "cliente@example.com",
  street: "Ramón Cruz Montt",
  streetNumber: "2137",
  floor: "3 B",
  betweenStreets: "X e Y",
  city: "La Libertad",
  postalCode: "3209",
  provinceId: 12,
  country: "Argentina",
  fbclid: "abc123",
  fbp: "fb.1.123.456",
  fbc: "fb.1.123.abc123",
};

function makeReq(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/intake", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json", origin: "https://landing.example.com", ...headers },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.offer.findFirst.mockResolvedValue({ id: "offer-1" });
  prismaMock.lead.findUnique.mockResolvedValue(null);
  prismaMock.lead.create.mockResolvedValue({ id: "lead-1" });
});

describe("POST /api/intake", () => {
  it("happy path: crea el lead (platform=landing) con todo mapeado", async () => {
    const res = await POST(makeReq(validPayload, { "x-forwarded-for": "1.2.3.4, 5.6.7.8" }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true, lead_id: "lead-1" });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://landing.example.com");

    const arg = prismaMock.lead.create.mock.calls[0]![0];
    expect(arg.data).toMatchObject({
      externalId: "22222222-2222-2222-2222-222222222222",
      platform: "landing",
      channel: "landing",
      offerId: "offer-1",
      customerName: "Prueba Test",
      customerPhone: "5491134422920", // sin "+" ni espacios
      customerProvinceId: 12,
      customerPostalCode: "3209",
      quantity: 2,
      totalPriceLocal: 98569,
      fbp: "fb.1.123.456",
      fbc: "fb.1.123.abc123",
      fbclid: "abc123",
      customerIp: "1.2.3.4",
    });
  });

  it("honeypot lleno => 200 sin crear lead (bot)", async () => {
    const res = await POST(makeReq({ ...validPayload, hp: "soy un bot" }));
    expect(res.status).toBe(200);
    expect(prismaMock.lead.create).not.toHaveBeenCalled();
  });

  it("payload inválido (sin nombre) => 400", async () => {
    const { name, ...noName } = validPayload;
    void name;
    const res = await POST(makeReq(noName));
    expect(res.status).toBe(400);
    expect(prismaMock.lead.create).not.toHaveBeenCalled();
  });

  it("provincia por texto si no viene provinceId", async () => {
    const { provinceId, ...noId } = validPayload;
    void provinceId;
    await POST(makeReq({ ...noId, province: "La Rioja" }));
    expect(prismaMock.lead.create.mock.calls[0]![0].data.customerProvinceId).toBe(12);
  });

  it("país sin catálogo (MX): provincia por texto, provinceId null, country del registry", async () => {
    const { provinceId, country, ...rest } = validPayload;
    void provinceId;
    void country;
    await POST(makeReq({ ...rest, countryCode: "MX", province: "Jalisco", phone: "525512345678" }));
    const data = prismaMock.lead.create.mock.calls[0]![0].data;
    expect(data.customerProvinceId).toBeNull();
    expect(data.customerRegion).toBe("Jalisco");
    expect(data.customerCountry).toBe("México");
  });

  it("dirección única (no-AR): `address` va a customerAddress, street queda null", async () => {
    const { street, streetNumber, country, ...rest } = validPayload;
    void street;
    void streetNumber;
    void country;
    await POST(makeReq({ ...rest, countryCode: "MX", province: "Jalisco", phone: "525512345678", address: "Av Reforma 123, depto 4" }));
    const data = prismaMock.lead.create.mock.calls[0]![0].data;
    expect(data.customerAddress).toBe("Av Reforma 123, depto 4");
    expect(data.customerStreet).toBeNull();
    expect(data.customerStreetNumber).toBeNull();
  });

  it("solo nombre y teléfono son obligatorios (resto opcional)", async () => {
    const res = await POST(makeReq({
      submitId: "33333333-3333-3333-3333-333333333333",
      sku: "SKU-P90", name: "Solo Minimo", phone: "5491100000000",
    }));
    expect(res.status).toBe(200);
    expect(prismaMock.lead.create).toHaveBeenCalled();
  });

  it("AR sin el 9: se normaliza agregándolo (WhatsApp)", async () => {
    await POST(makeReq({ ...validPayload, phone: "541134422920" })); // 54 + 10 nacionales, sin 9
    expect(prismaMock.lead.create.mock.calls[0]![0].data.customerPhone).toBe("5491134422920");
  });

  it("teléfono inválido para el país (muy corto) => 400", async () => {
    const res = await POST(makeReq({ ...validPayload, phone: "5491234" }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: "invalid_phone" });
    expect(prismaMock.lead.create).not.toHaveBeenCalled();
  });

  it("teléfono con todos los dígitos iguales => 400", async () => {
    const res = await POST(makeReq({ ...validPayload, phone: "5491111111111" }));
    expect(res.status).toBe(400);
    expect(prismaMock.lead.create).not.toHaveBeenCalled();
  });

  it("SKU sin oferta => lead con offerId null", async () => {
    prismaMock.offer.findFirst.mockResolvedValue(null);
    await POST(makeReq(validPayload));
    expect(prismaMock.lead.create.mock.calls[0]![0].data.offerId).toBeNull();
  });

  it("idempotencia: submit repetido => duplicate, no crea de nuevo", async () => {
    prismaMock.lead.findUnique.mockResolvedValue({ id: "lead-existente" });
    const res = await POST(makeReq(validPayload));
    await expect(res.json()).resolves.toMatchObject({ ok: true, lead_id: "lead-existente", duplicate: true });
    expect(prismaMock.lead.create).not.toHaveBeenCalled();
  });

  it("OPTIONS => 204 con headers CORS", () => {
    const res = OPTIONS(makeReq(validPayload));
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  });
});
