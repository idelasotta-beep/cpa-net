import bcrypt from "bcryptjs";
import { env } from "@/lib/env";

/**
 * Resuelve el hash bcrypt admitiendo dos formatos:
 *  - bcrypt directo ("$2a/$2b/$2y$...")
 *  - base64 del hash (para evitar que plataformas como Railway corrompan los "$")
 */
function resolveHash(raw: string): string {
  if (raw.startsWith("$2")) return raw;
  try {
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    if (decoded.startsWith("$2")) return decoded;
  } catch {
    // ignore
  }
  return raw;
}

/**
 * Valida las credenciales del único usuario del dashboard contra las env vars.
 * Corre solo en node (login server action), nunca en el middleware.
 */
export async function verifyCredentials(
  email: string,
  password: string,
): Promise<boolean> {
  if (!env.DASHBOARD_USER_EMAIL || !env.DASHBOARD_USER_PASSWORD_HASH) {
    return false;
  }
  if (email.trim().toLowerCase() !== env.DASHBOARD_USER_EMAIL.trim().toLowerCase()) {
    return false;
  }
  return bcrypt.compare(password, resolveHash(env.DASHBOARD_USER_PASSWORD_HASH));
}
