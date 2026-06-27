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

  // ── Adcombo (Fase 2) ──
  ADCOMBO_API_KEY: z.string().optional().default(""),
  ADCOMBO_API_BASE_URL: z
    .string()
    .url()
    .default("https://api.adcombo.com/api/v2"),
  ADCOMBO_OFFER_INFO_URL: z
    .string()
    .url()
    .default("https://api.adcombo.com/offer/info/"),
  // Params opcionales del create (base_url conviene consultarlo con el AM).
  ADCOMBO_DEFAULT_BASE_URL: z.string().optional().default(""),
  ADCOMBO_DEFAULT_REFERRER: z.string().optional().default(""),

  // Auth de los endpoints de jobs/admin (Bearer). Railway no lo inyecta solo.
  CRON_SECRET: z.string().optional().default(""),

  // Máximo de intentos de push a la red antes de marcar el lead como failed.
  MAX_PUSH_ATTEMPTS: z.coerce.number().int().positive().default(5),

  // ── Dashboard auth (Fase 3) ──
  DASHBOARD_USER_EMAIL: z.string().optional().default(""),
  DASHBOARD_USER_PASSWORD_HASH: z.string().optional().default(""), // bcrypt
  SESSION_SECRET: z.string().optional().default(""), // firma del JWT de sesión

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
