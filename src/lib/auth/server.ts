import { cookies } from "next/headers";
import { SESSION_COOKIE, type Session, verifySessionToken } from "./session";

/** Lee y valida la sesión actual desde la cookie (server components / actions). */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}
