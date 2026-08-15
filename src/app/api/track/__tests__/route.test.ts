import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { landingStat: { upsert: vi.fn() } },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { OPTIONS, POST } from "@/app/api/track/route";

function makeReq(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/track", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json", origin: "https://landing.example.com", ...headers },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.landingStat.upsert.mockResolvedValue({});
});

describe("POST /api/track", () => {
  it("cuenta una visita (view) y, si unique, incrementa únicos", async () => {
    const res = await POST(makeReq({ landingId: "es-linterna-1", unique: true }));
    expect(res.status).toBe(204);
    const arg = prismaMock.landingStat.upsert.mock.calls[0]![0];
    expect(arg.where.landingId_date.landingId).toBe("es-linterna-1");
    expect(arg.create).toMatchObject({ views: 1, uniques: 1 });
    expect(arg.update.views).toEqual({ increment: 1 });
    expect(arg.update.uniques).toEqual({ increment: 1 });
  });

  it("view no-único: no incrementa uniques", async () => {
    await POST(makeReq({ landingId: "es-linterna-1", unique: false }));
    const arg = prismaMock.landingStat.upsert.mock.calls[0]![0];
    expect(arg.create.uniques).toBe(0);
    expect(arg.update.uniques).toBeUndefined();
  });

  it("sin landingId => 204 sin tocar la DB", async () => {
    const res = await POST(makeReq({ unique: true }));
    expect(res.status).toBe(204);
    expect(prismaMock.landingStat.upsert).not.toHaveBeenCalled();
  });

  it("body malformado => 204 silencioso", async () => {
    const res = await POST(makeReq("no-json{"));
    expect(res.status).toBe(204);
    expect(prismaMock.landingStat.upsert).not.toHaveBeenCalled();
  });

  it("OPTIONS => 204 con CORS", () => {
    const res = OPTIONS(makeReq({}));
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  });
});
