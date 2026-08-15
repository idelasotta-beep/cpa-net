import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

// DB → runtime Node.
export const runtime = "nodejs";

const log = logger.child({ route: "POST /api/track" });

// ── CORS (el beacon viene de la landing en otro origen) ──
function corsOrigin(req: Request): string {
  const origin = req.headers.get("origin") ?? "";
  const allowed = env.LANDING_ALLOWED_ORIGINS.split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  if (allowed.length === 0) return origin || "*";
  return allowed.includes(origin) ? origin : allowed[0]!;
}

function corsHeaders(req: Request): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": corsOrigin(req),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function OPTIONS(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

// Rate-limit en memoria por IP (los beacons son de alta frecuencia pero baratos).
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 60;
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

/** Día actual a medianoche UTC (clave del agregado diario). */
function todayUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Beacon de visitas de la landing propia. Sin PII: solo cuenta page views y únicos
 * (el cliente marca `unique` una vez por visitante/día) agregados por landing y día.
 * Responde 204 siempre (fire-and-forget); nunca rompe la landing.
 */
export async function POST(req: Request): Promise<Response> {
  const headers = corsHeaders(req);
  try {
    const ip = clientIp(req);
    if (ip && rateLimited(ip)) {
      return new Response(null, { status: 204, headers });
    }

    const raw = await req.text();
    let body: { landingId?: unknown; unique?: unknown };
    try {
      body = JSON.parse(raw);
    } catch {
      return new Response(null, { status: 204, headers }); // beacon malformado: se ignora
    }

    const landingId = typeof body.landingId === "string" ? body.landingId.trim().slice(0, 100) : "";
    if (!landingId) return new Response(null, { status: 204, headers });
    const unique = body.unique === true;

    const date = todayUtc();
    await prisma.landingStat.upsert({
      where: { landingId_date: { landingId, date } },
      create: { landingId, date, views: 1, uniques: unique ? 1 : 0 },
      update: { views: { increment: 1 }, ...(unique ? { uniques: { increment: 1 } } : {}) },
    });

    return new Response(null, { status: 204, headers });
  } catch (err) {
    log.error({ err: err instanceof Error ? err.message : err }, "error en beacon de tracking");
    return new Response(null, { status: 204, headers }); // nunca propaga error al cliente
  }
}
