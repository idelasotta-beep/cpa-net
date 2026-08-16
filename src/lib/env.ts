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

  // ── Landing propia (form COD self-hosted → /api/intake) ──
  // Orígenes permitidos para CORS (coma-separado). Vacío = refleja cualquier origen (dev).
  LANDING_ALLOWED_ORIGINS: z.string().optional().default(""),

  // ── Ingesta Shopify (form COD de Releasit) ──
  // Secreto de firma del webhook de Shopify (header X-Shopify-Hmac-Sha256, base64).
  // Opcional: si está vacío, la verificación se omite (solo para dev local).
  SHOPIFY_WEBHOOK_SECRET: z.string().optional().default(""),
  // App id de Releasit en Shopify. Si está seteado, solo se ingieren las órdenes
  // creadas por esa app (se descartan órdenes manuales/otras). Vacío = ingerir todas.
  SHOPIFY_RELEASIT_APP_ID: z.string().optional().default(""),

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
  // Token secreto propio para validar los postbacks de Adcombo (van sin HMAC).
  ADCOMBO_POSTBACK_TOKEN: z.string().optional().default(""),
  // Params opcionales del create (base_url conviene consultarlo con el AM).
  ADCOMBO_DEFAULT_BASE_URL: z.string().optional().default(""),
  ADCOMBO_DEFAULT_REFERRER: z.string().optional().default(""),

  // ── Latinleads (red CPA vía IGALFER) ──
  LATINLEADS_API_KEY: z.string().optional().default(""),
  LATINLEADS_API_BASE_URL: z.string().url().default("https://igalfer.com"),
  LATINLEADS_PUBLISHER_ID: z.string().optional().default(""),
  // Token secreto propio para validar los postbacks de Latinleads (van sin HMAC).
  LATINLEADS_POSTBACK_TOKEN: z.string().optional().default(""),

  // ── Latinecom / Latinecom (red CPA, fulfillment COD Argentina) ──
  LATINECOM_API_KEY: z.string().optional().default(""),
  LATINECOM_API_BASE_URL: z.string().url().default("https://latinecom.com"),
  LATINECOM_PUBLISHER_ID: z.string().optional().default(""),
  // Token secreto propio para validar los postbacks de Latinecom (van sin HMAC).
  LATINECOM_POSTBACK_TOKEN: z.string().optional().default(""),

  // ── Meta Conversions API (Purchase server-side en la aprobación del lead) ──
  // Si falta pixel id o token, el evento se omite (no rompe el postback).
  META_PIXEL_ID: z.string().optional().default(""), // pixel por defecto (fallback global)
  META_CAPI_ACCESS_TOKEN: z.string().optional().default(""), // token del pixel por defecto
  // Multi-pixel: mapa JSON pixelId→access token, ej. {"12463...":"EAAH...","98765...":"EAAB..."}.
  // Permite un pixel por país/oferta; el CAPI usa el token del pixel del lead. El token
  // vive SOLO acá (server-side), nunca en la landing pública.
  META_CAPI_TOKENS: z.string().optional().default("{}"),
  META_CAPI_TEST_EVENT_CODE: z.string().optional().default(""), // para el Test Events de Meta
  META_CAPI_ACTION_SOURCE: z.string().optional().default("website"),

  // Auth de los endpoints de jobs/admin (Bearer). Railway no lo inyecta solo.
  CRON_SECRET: z.string().optional().default(""),

  // Máximo de intentos de push a la red antes de marcar el lead como failed.
  MAX_PUSH_ATTEMPTS: z.coerce.number().int().positive().default(5),

  // ── Dashboard auth (Fase 3) ──
  DASHBOARD_USER_EMAIL: z.string().optional().default(""),
  DASHBOARD_USER_PASSWORD_HASH: z.string().optional().default(""), // bcrypt
  SESSION_SECRET: z.string().optional().default(""), // firma del JWT de sesión

  // ── Alertas Telegram (opcional) ──
  TELEGRAM_BOT_TOKEN: z.string().optional().default(""),
  TELEGRAM_CHAT_ID: z.string().optional().default(""),

  // ── Alertas Email vía SMTP (opcional) ──
  SMTP_HOST: z.string().optional().default(""),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASS: z.string().optional().default(""),
  SMTP_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  EMAIL_FROM: z.string().optional().default(""),
  EMAIL_TO: z.string().optional().default(""),

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
