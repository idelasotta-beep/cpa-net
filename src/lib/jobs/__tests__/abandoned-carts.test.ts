import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    appSettings: { findUnique: vi.fn() },
    abandonedCart: { findMany: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { runAbandonedCartWebhook } from "@/lib/jobs/abandoned-carts";

const enabledSettings = {
  abandonedWebhookEnabled: true,
  abandonedWebhookUrl: "https://hook.example.com/wh",
  abandonedWebhookToken: "secret-token",
  abandonedDelayMinutes: 20,
};

const cart = {
  id: "c1",
  submitId: "s1",
  landingId: "es-l",
  sku: "SKU-P90",
  countryCode: "AR",
  customerName: "Ana",
  customerPhone: "5491134422920",
  payload: { name: "Ana", city: "CABA" },
  createdAt: new Date("2026-08-16T00:00:00Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.abandonedCart.update.mockResolvedValue({});
});
afterEach(() => vi.restoreAllMocks());

describe("runAbandonedCartWebhook", () => {
  it("deshabilitado => skipped, no consulta carritos", async () => {
    prismaMock.appSettings.findUnique.mockResolvedValue({ abandonedWebhookEnabled: false });
    const r = await runAbandonedCartWebhook();
    expect(r.skipped).toBe("disabled");
    expect(prismaMock.abandonedCart.findMany).not.toHaveBeenCalled();
  });

  it("envía el webhook y marca webhookSentAt en 2xx", async () => {
    prismaMock.appSettings.findUnique.mockResolvedValue(enabledSettings);
    prismaMock.abandonedCart.findMany.mockResolvedValue([cart]);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock as unknown as typeof fetch;

    const r = await runAbandonedCartWebhook();
    expect(r).toMatchObject({ candidates: 1, sent: 1, failed: 0 });

    const [url, opts] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("https://hook.example.com/wh");
    expect((opts.headers as Record<string, string>).Authorization).toBe("Bearer secret-token");
    const body = JSON.parse(opts.body as string);
    expect(body).toMatchObject({ event: "abandoned_cart", submitId: "s1", phone: "5491134422920" });

    const upd = prismaMock.abandonedCart.update.mock.calls[0]![0];
    expect(upd.data.webhookSentAt).toBeInstanceOf(Date);
  });

  it("no-2xx => cuenta failed, incrementa attempts, no marca enviado", async () => {
    prismaMock.appSettings.findUnique.mockResolvedValue(enabledSettings);
    prismaMock.abandonedCart.findMany.mockResolvedValue([cart]);
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;

    const r = await runAbandonedCartWebhook();
    expect(r).toMatchObject({ candidates: 1, sent: 0, failed: 1 });
    const upd = prismaMock.abandonedCart.update.mock.calls[0]![0];
    expect(upd.data.webhookAttempts).toEqual({ increment: 1 });
    expect(upd.data.webhookSentAt).toBeUndefined();
  });
});
