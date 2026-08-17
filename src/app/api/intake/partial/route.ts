import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getCountry } from "@/lib/geo/countries";
import { corsHeaders } from "@/lib/http/landing-cors";
import { checkPhone } from "@/lib/leads/phone-validation";
import { logger } from "@/lib/logger";

// DB → runtime Node.
export const runtime = "nodejs";

const log = logger.child({ route: "POST /api/intake/partial" });

export function OPTIONS(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

// Rate-limit en memoria por IP (más laxo: los parciales son de blur, alta frecuencia).
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > MAX_PER_WINDOW;
}

function clientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip");
}

function str(v: unknown, max = 200): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
}

/**
 * Captura de carrito abandonado: el form manda un parcial cuando el teléfono valida
 * (en blur), antes de completar. Guardamos SOLO si el teléfono es válido para el país
 * (evita basura a medio tipear). Idempotente por submitId. Responde 204 (fire-and-forget).
 * NO crea lead ni se pushea a la red; el job dispara el webhook si no se completa.
 */
export async function POST(req: Request): Promise<Response> {
  const headers = corsHeaders(req);
  try {
    const ip = clientIp(req);
    if (ip && rateLimited(ip)) return new Response(null, { status: 204, headers });

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(await req.text());
    } catch {
      return new Response(null, { status: 204, headers });
    }

    // Honeypot → ignorar.
    if (str(body.hp)) return new Response(null, { status: 204, headers });

    const submitId = str(body.submitId, 100);
    if (!submitId) return new Response(null, { status: 204, headers });

    // Solo capturamos con teléfono válido para el país (libphonenumber).
    const country = getCountry(str(body.countryCode, 2));
    const rawPhone = typeof body.phone === "string" ? body.phone : "";
    const phoneCheck = checkPhone(country.iso2, rawPhone);
    if (!phoneCheck.valid || !phoneCheck.phone) {
      return new Response(null, { status: 204, headers });
    }
    const phone = phoneCheck.phone;

    const payload = { ...body };
    delete payload.hp;
    // Señal explícita de abandono (cerró popup / se fue) → marca abandonedAt para
    // que el job dispare el webhook rápido (sin esperar toda la ventana de gracia).
    const abandoned = body.abandoned === true ? { abandonedAt: new Date() } : {};
    const fields = {
      landingId: str(body.landingId, 100),
      sku: str(body.sku, 100),
      countryCode: country.iso2,
      customerName: str(body.name),
      customerPhone: phone,
      payload: payload as Prisma.InputJsonValue,
    };
    await prisma.abandonedCart.upsert({
      where: { submitId },
      create: { submitId, ...fields, ...abandoned },
      update: { ...fields, ...abandoned },
    });

    return new Response(null, { status: 204, headers });
  } catch (err) {
    log.error({ err: err instanceof Error ? err.message : err }, "error en captura parcial");
    return new Response(null, { status: 204, headers });
  }
}
