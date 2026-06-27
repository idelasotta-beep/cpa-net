import { SignJWT, jwtVerify } from "jose";

/**
 * Sesión del dashboard como JWT firmado (HS256), edge-compatible (jose).
 * Lee SESSION_SECRET directo de process.env para no arrastrar la validación
 * completa de env (ni la dependencia de DB) al bundle del middleware.
 */
export const SESSION_COOKIE = "cpa_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 días

function getSecret(): Uint8Array {
  const s = process.env.SESSION_SECRET || "dev-insecure-secret-change-me";
  return new TextEncoder().encode(s);
}

export interface Session {
  email: string;
}

export async function createSessionToken(email: string): Promise<string> {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySessionToken(
  token: string | undefined | null,
): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.email !== "string") return null;
    return { email: payload.email };
  } catch {
    return null;
  }
}

export const SESSION_MAX_AGE = MAX_AGE_SECONDS;
