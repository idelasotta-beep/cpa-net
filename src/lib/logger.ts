import pino from "pino";
import { env } from "./env";

/**
 * Logger estructurado (pino). En desarrollo usa pino-pretty para legibilidad.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  ...(env.NODE_ENV === "development"
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:standard" },
        },
      }
    : {}),
});

/**
 * Enmascara un teléfono para logging: deja prefijo + sufijo visibles.
 * "+56992498360" -> "+569****8360". Nunca loggear el teléfono completo.
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.length <= 8) return "****";
  const prefix = digits.slice(0, 4);
  const suffix = digits.slice(-4);
  return `${prefix}****${suffix}`;
}
