import { timingSafeEqual } from "node:crypto";
import { env } from "./env";

/**
 * Valida `Authorization: Bearer <CRON_SECRET>` en endpoints de jobs/admin.
 * Si CRON_SECRET no está configurado, deniega (no dejamos endpoints abiertos).
 */
export function isAuthorized(req: Request): boolean {
  if (!env.CRON_SECRET) return false;
  const header = req.headers.get("authorization") ?? "";
  const prefix = "Bearer ";
  if (!header.startsWith(prefix)) return false;
  const token = header.slice(prefix.length);

  const a = Buffer.from(token);
  const b = Buffer.from(env.CRON_SECRET);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
