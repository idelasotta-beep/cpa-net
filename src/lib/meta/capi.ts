import { createHash } from "node:crypto";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Meta Conversions API (server-side).
 *
 * En el modelo CPA se cobra por LEAD APROBADO (postback Sales de EcomLatam), no por
 * form-fill. Por eso el evento `Purchase` se dispara acá, desde el servidor, cuando
 * llega la aprobación — así Meta optimiza hacia leads que se convierten en plata.
 * Releasit dispara el evento de intención (Lead) en el navegador; este es el de abajo
 * del funnel. Best-effort: un fallo del CAPI NUNCA debe romper el postback.
 */

const log = logger.child({ module: "meta-capi" });
const GRAPH_VERSION = "v21.0";

function sha256(v: string): string {
  return createHash("sha256").update(v).digest("hex");
}

/** Email normalizado (trim + minúsculas) y hasheado, o undefined. */
function hashEmail(email: string | null | undefined): string | undefined {
  const n = email?.trim().toLowerCase();
  return n ? sha256(n) : undefined;
}

/** Teléfono a solo dígitos y hasheado, o undefined. */
function hashPhone(phone: string | null | undefined): string | undefined {
  const d = phone?.replace(/\D/g, "");
  return d ? sha256(d) : undefined;
}

export interface PurchaseEventInput {
  /** Dedup key de Meta (usamos lead.id → idempotente si el postback se repite). */
  eventId: string;
  value: number;
  currency?: string;
  email?: string | null;
  phone?: string | null;
  ip?: string | null;
  externalId?: string | null;
  contentIds?: string[];
  /** unix seconds; default ahora. Ventana de Meta: 7 días. */
  eventTime?: number;
}

export function isCapiConfigured(): boolean {
  return Boolean(env.META_PIXEL_ID && env.META_CAPI_ACCESS_TOKEN);
}

export async function sendPurchaseEvent(
  input: PurchaseEventInput,
): Promise<{ ok: boolean; error?: string }> {
  if (!isCapiConfigured()) {
    log.warn("Meta CAPI no configurado (META_PIXEL_ID/META_CAPI_ACCESS_TOKEN): evento omitido");
    return { ok: false, error: "not_configured" };
  }

  const userData: Record<string, unknown> = {};
  const em = hashEmail(input.email);
  if (em) userData.em = [em];
  const ph = hashPhone(input.phone);
  if (ph) userData.ph = [ph];
  if (input.externalId) userData.external_id = [sha256(input.externalId)];
  if (input.ip) userData.client_ip_address = input.ip;

  const event: Record<string, unknown> = {
    event_name: "Purchase",
    event_time: input.eventTime ?? Math.floor(Date.now() / 1000),
    action_source: env.META_CAPI_ACTION_SOURCE,
    event_id: input.eventId,
    user_data: userData,
    custom_data: {
      value: input.value,
      currency: input.currency ?? "USD",
      ...(input.contentIds && input.contentIds.length > 0
        ? { content_ids: input.contentIds, content_type: "product" }
        : {}),
    },
  };

  const body: Record<string, unknown> = { data: [event] };
  if (env.META_CAPI_TEST_EVENT_CODE) body.test_event_code = env.META_CAPI_TEST_EVENT_CODE;

  try {
    const url = `https://graph.facebook.com/${GRAPH_VERSION}/${env.META_PIXEL_ID}/events?access_token=${encodeURIComponent(env.META_CAPI_ACCESS_TOKEN)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { events_received?: number };
    if (!res.ok) {
      log.error({ status: res.status, data }, "Meta CAPI respondió error");
      return { ok: false, error: `HTTP ${res.status}` };
    }
    log.info(
      { eventId: input.eventId, eventsReceived: data.events_received },
      "Meta CAPI Purchase enviado",
    );
    return { ok: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    log.error({ error }, "Meta CAPI falló");
    return { ok: false, error };
  }
}
