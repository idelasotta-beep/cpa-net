import { z } from "zod";

/**
 * Payload del form COD propio (landing self-hosted) → POST /api/intake.
 *
 * Como el form es NUESTRO, controlamos los nombres y mandamos el provinceId (1-24)
 * directo (con fallback a texto). Incluye los IDs de Meta capturados en la landing
 * (fbclid/fbp/fbc) para el match del CAPI — lo que Releasit no nos daba.
 */

const optStr = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

export const intakePayloadSchema = z.object({
  // Honeypot anti-bot: campo oculto que un humano deja vacío.
  hp: z.string().optional(),
  // Idempotencia: el form genera un UUID por submit y lo reusa en reintentos.
  submitId: optStr,

  // Producto / combo
  sku: z.string().trim().min(1),
  quantity: z.coerce.number().int().min(1).max(3).default(1),
  totalPriceLocal: z.coerce.number().positive().optional(),

  // Cliente
  name: z.string().trim().min(1),
  phone: z.string().trim().min(1),
  email: optStr,

  // Dirección estructurada
  street: z.string().trim().min(1),
  streetNumber: z.string().trim().min(1),
  floor: optStr,
  apartment: optStr,
  betweenStreets: optStr,
  shippingNotes: optStr,
  city: z.string().trim().min(1),
  postalCode: z.string().trim().min(1),
  provinceId: z.coerce.number().int().min(1).max(24).optional(),
  province: optStr, // fallback texto si no viene provinceId
  country: z.string().trim().default("Argentina"),

  // Tracking / Meta
  fbclid: optStr,
  fbp: optStr,
  fbc: optStr,
  utmSource: optStr,
  utmCampaign: optStr,
  utmContent: optStr,
  utmTerm: optStr,
});

export type IntakePayload = z.infer<typeof intakePayloadSchema>;
