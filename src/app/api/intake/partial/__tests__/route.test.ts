import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { abandonedCart: { upsert: vi.fn() } },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { POST } from "@/app/api/intake/partial/route";

function makeReq(body: unknown): Request {
  return new Request("http://localhost/api/intake/partial", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json", origin: "https://landing.example.com" },
  });
}

const base = {
  submitId: "44444444-4444-4444-4444-444444444444",
  countryCode: "AR",
  phone: "5491134422920", // como lo manda el form (código + 9 de móvil)
  name: "Cliente Parcial",
  landingId: "es-linterna-1",
  sku: "SKU-P90",
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.abandonedCart.upsert.mockResolvedValue({});
});

describe("POST /api/intake/partial", () => {
  it("captura con teléfono válido: upsert con teléfono normalizado (AR +9)", async () => {
    const res = await POST(makeReq(base));
    expect(res.status).toBe(204);
    const arg = prismaMock.abandonedCart.upsert.mock.calls[0]![0];
    expect(arg.where.submitId).toBe(base.submitId);
    expect(arg.create.customerPhone).toBe("5491134422920");
    expect(arg.create.customerName).toBe("Cliente Parcial");
    expect(arg.create.landingId).toBe("es-linterna-1");
  });

  it("señal abandoned:true => setea abandonedAt (webhook rápido)", async () => {
    await POST(makeReq({ ...base, abandoned: true }));
    const arg = prismaMock.abandonedCart.upsert.mock.calls[0]![0];
    expect(arg.create.abandonedAt).toBeInstanceOf(Date);
    expect(arg.update.abandonedAt).toBeInstanceOf(Date);
  });

  it("sin señal => no setea abandonedAt", async () => {
    await POST(makeReq(base));
    const arg = prismaMock.abandonedCart.upsert.mock.calls[0]![0];
    expect(arg.create.abandonedAt).toBeUndefined();
  });

  it("teléfono inválido => no captura", async () => {
    await POST(makeReq({ ...base, phone: "123" }));
    expect(prismaMock.abandonedCart.upsert).not.toHaveBeenCalled();
  });

  it("sin submitId => no captura", async () => {
    const { submitId, ...noId } = base;
    void submitId;
    await POST(makeReq(noId));
    expect(prismaMock.abandonedCart.upsert).not.toHaveBeenCalled();
  });

  it("honeypot => no captura", async () => {
    await POST(makeReq({ ...base, hp: "bot" }));
    expect(prismaMock.abandonedCart.upsert).not.toHaveBeenCalled();
  });
});
