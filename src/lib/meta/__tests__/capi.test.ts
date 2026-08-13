import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Env mockeado y mutable (env.ts se resuelve al importar; así controlamos config por test).
const { mockEnv } = vi.hoisted(() => ({
  mockEnv: {
    // usados por logger.ts (capi importa el logger)
    LOG_LEVEL: "silent",
    NODE_ENV: "test",
    META_PIXEL_ID: "PIXEL123",
    META_CAPI_ACCESS_TOKEN: "TOKEN-abc",
    META_CAPI_ACTION_SOURCE: "website",
    META_CAPI_TEST_EVENT_CODE: "",
  },
}));
vi.mock("@/lib/env", () => ({ env: mockEnv }));

import { isCapiConfigured, sendPurchaseEvent } from "@/lib/meta/capi";

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

function mockFetch(payload: unknown, init: { ok?: boolean; status?: number } = {}) {
  const fn = vi.fn().mockResolvedValue({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => payload,
  });
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

beforeEach(() => {
  mockEnv.META_PIXEL_ID = "PIXEL123";
  mockEnv.META_CAPI_ACCESS_TOKEN = "TOKEN-abc";
  mockEnv.META_CAPI_ACTION_SOURCE = "website";
  mockEnv.META_CAPI_TEST_EVENT_CODE = "";
});
afterEach(() => vi.restoreAllMocks());

describe("sendPurchaseEvent", () => {
  it("arma el Purchase con datos hasheados y lo postea al pixel", async () => {
    const fn = mockFetch({ events_received: 1 });
    const res = await sendPurchaseEvent({
      eventId: "lead-1",
      value: 14.5,
      currency: "USD",
      email: " Cliente@Example.com ",
      phone: "+54 9 381 457 2504",
      ip: "2803:c600::1",
      externalId: "lead-1",
      contentIds: ["SKU-P90"],
    });
    expect(res).toEqual({ ok: true });

    const [url, opts] = fn.mock.calls[0]! as [string, RequestInit];
    expect(url).toContain("/PIXEL123/events");
    expect(url).toContain("access_token=TOKEN-abc");

    const body = JSON.parse(opts.body as string);
    const event = body.data[0];
    expect(event.event_name).toBe("Purchase");
    expect(event.action_source).toBe("website");
    expect(event.event_id).toBe("lead-1");
    expect(event.custom_data).toMatchObject({
      value: 14.5,
      currency: "USD",
      content_ids: ["SKU-P90"],
      content_type: "product",
    });
    // email normalizado (trim + minúsculas) antes de hashear
    expect(event.user_data.em).toEqual([sha256("cliente@example.com")]);
    // teléfono a solo dígitos antes de hashear
    expect(event.user_data.ph).toEqual([sha256("5493814572504")]);
    expect(event.user_data.client_ip_address).toBe("2803:c600::1");
    expect(event.user_data.external_id).toEqual([sha256("lead-1")]);
  });

  it("incluye test_event_code si está configurado", async () => {
    mockEnv.META_CAPI_TEST_EVENT_CODE = "TEST123";
    const fn = mockFetch({ events_received: 1 });
    await sendPurchaseEvent({ eventId: "lead-2", value: 10 });
    const body = JSON.parse((fn.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.test_event_code).toBe("TEST123");
  });

  it("si no está configurado, no llama a Meta", async () => {
    mockEnv.META_PIXEL_ID = "";
    const fn = mockFetch({});
    const res = await sendPurchaseEvent({ eventId: "lead-3", value: 10 });
    expect(res).toEqual({ ok: false, error: "not_configured" });
    expect(fn).not.toHaveBeenCalled();
    expect(isCapiConfigured()).toBe(false);
  });

  it("devuelve ok=false si Meta responde error HTTP", async () => {
    mockFetch({ error: { message: "bad" } }, { ok: false, status: 400 });
    const res = await sendPurchaseEvent({ eventId: "lead-4", value: 10 });
    expect(res.ok).toBe(false);
    expect(res.error).toContain("400");
  });

  it("no rompe ante excepción de red (best-effort)", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;
    const res = await sendPurchaseEvent({ eventId: "lead-5", value: 10 });
    expect(res).toEqual({ ok: false, error: "network down" });
  });
});
