import { z } from "zod";

/**
 * Validación de variables de entorno (fail-fast al arranque).
 * Solo las necesarias para la Fase 1. Las de redes CPA (Adcombo) y dashboard
 * se agregan en sus fases.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  // Base de datos (Postgres).
  DATABASE_URL: z.string().min(1, "DATABASE_URL es requerida"),
  DIRECT_URL: z.string().min(1).optional(),

  // Secreto HMAC del webhook de EstrategiasIA (X-Estrategas-Signature).
  // Opcional: si está vacío, la verificación se omite (solo para dev local).
  PLATFORM_WEBHOOK_SECRET: z.string().optional().default(""),

  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"])
    .default("info"),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`❌ Variables de entorno inválidas:\n${issues}`);
  }
  return parsed.data;
}

export const env = loadEnv();
export type Env = typeof env;
