/**
 * CORS de los endpoints públicos de la landing propia (intake + track).
 *
 * `LANDING_ALLOWED_ORIGINS` es una lista separada por coma. Cada entrada puede ser:
 *   - un origen exacto: `https://linterna.teleservespa.com`
 *   - un comodín de host: `*.teleservespa.com` (cualquier subdominio; NO el apex)
 *   - un comodín con scheme: `https://*.teleservespa.com`
 *
 * Vacía ⇒ modo dev: refleja el origen (abierto). Con lista, un origen no permitido
 * recibe `null` como Access-Control-Allow-Origin (el navegador lo bloquea).
 */
import { env } from "@/lib/env";

function reEscape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Matchea un origen contra una entrada con comodín (`*`). */
function wildcardMatch(entry: string, origin: string): boolean {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  let pattern = entry;
  const scheme = pattern.match(/^(https?):\/\//i);
  if (scheme) {
    if (url.protocol.toLowerCase() !== `${scheme[1]!.toLowerCase()}:`) return false;
    pattern = pattern.slice(scheme[0].length);
  }
  const host = url.hostname.toLowerCase();
  // `*.dominio.com` ⇒ cualquier subdominio, pero no el apex.
  if (pattern.startsWith("*.")) {
    const suffix = pattern.slice(1).toLowerCase(); // ".dominio.com"
    return host.endsWith(suffix) && host.length > suffix.length;
  }
  // Patrón general con `*` en cualquier posición.
  const re = new RegExp(`^${pattern.split("*").map(reEscape).join(".*")}$`, "i");
  return re.test(host);
}

/** ¿El origen está permitido por alguna entrada (exacta o comodín)? */
export function isOriginAllowed(origin: string, allowed: string[]): boolean {
  for (const entry of allowed) {
    if (entry === origin) return true; // exacto (con scheme)
    if (entry.includes("*") && wildcardMatch(entry, origin)) return true;
  }
  return false;
}

/** Lista de orígenes configurada (trim + sin vacíos). */
export function allowedOrigins(): string[] {
  return env.LANDING_ALLOWED_ORIGINS.split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

/** Valor de Access-Control-Allow-Origin para este request. */
export function corsOrigin(req: Request): string {
  const origin = req.headers.get("origin") ?? "";
  const allowed = allowedOrigins();
  if (allowed.length === 0) return origin || "*"; // dev: refleja el origen
  if (origin && isOriginAllowed(origin, allowed)) return origin;
  return "null"; // no permitido: el navegador bloquea
}

/** Headers CORS para los endpoints públicos de la landing (POST + preflight). */
export function corsHeaders(req: Request): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": corsOrigin(req),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}
