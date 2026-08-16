import { timingSafeEqual } from "node:crypto";
import { env } from "./env";

/**
 * Extrae el token del request: `Authorization: Bearer <token>` o, para schedulers
 * que no mandan headers (ej. el test de cron-job.org), el query param `?token=`/`?secret=`.
 */
function extractToken(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  const prefix = "Bearer ";
  if (header.startsWith(prefix)) return header.slice(prefix.length);
  try {
    const sp = new URL(req.url).searchParams;
    return sp.get("token") || sp.get("secret") || null;
  } catch {
    return null;
  }
}

/**
 * Valida el CRON_SECRET en endpoints de jobs/admin (header Bearer o query param).
 * Si CRON_SECRET no está configurado, deniega (no dejamos endpoints abiertos).
 */
export function isAuthorized(req: Request): boolean {
  if (!env.CRON_SECRET) return false;
  const token = extractToken(req);
  if (!token) return false;

  const a = Buffer.from(token);
  const b = Buffer.from(env.CRON_SECRET);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
