import bcrypt from "bcryptjs";
import { env } from "@/lib/env";

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
  return bcrypt.compare(password, env.DASHBOARD_USER_PASSWORD_HASH);
}
