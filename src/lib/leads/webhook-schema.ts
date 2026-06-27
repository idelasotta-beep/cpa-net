import { z } from "zod";

/**
 * Schema del payload del webhook `order.created` de EstrategiasIA.
 *
 * Estructura confirmada contra el payload real (2026-06-27).
 * IMPORTANTE: EstrategiasIA envía `null` (no ausencia) en los campos vacíos,
 * por eso los opcionales usan `.nullish()` (acepta string | null | undefined).
 */

// String opcional tolerante a null.
const optStr = z.string().nullish();

// Número opcional tolerante a null (no coacciona null a 0 gracias a nullish).
const optNum = z.coerce.number().nullish();

// Acepta string | number | null | undefined y normaliza a string | null
// (ej. dropi_product_id "56579" / 56579 / null).
const idLike = z
  .union([z.string(), z.number()])
  .nullish()
  .transform((v) => (v === undefined || v === null ? null : String(v).trim()));

const itemSchema = z.object({
  product_name: optStr,
  variant_name: optStr,
  quantity: optNum,
  unit_price: optNum,
  total_price: optNum,
  dropi_product_id: idLike,
  dropi_variation_id: idLike,
});

const customerSchema = z.object({
  name: z.string().min(1),
  surname: optStr,
  phone: z.string().min(1),
  phone2: optStr,
  phone3: optStr,
  email: optStr,
  dni: optStr,
});

const orderSchema = z.object({
  number: z.coerce.string().min(1),
  created_at: optStr,
  created_via: z.string().min(1),
  currency: optStr,
  status: optStr,
  payment_method: optStr,
  total: optNum,
  subtotal: optNum,
  discount: optNum,
  shipping_cost: optNum,
  utm_source: optStr,
  utm_medium: optStr,
  utm_campaign: optStr,
  utm_content: optStr,
  utm_term: optStr,
  customer: customerSchema,
  shipping_address: optStr,
  shipping_city: optStr,
  shipping_state: optStr,
  shipping_neighborhood: optStr,
  shipping_zip_code: optStr,
  shipping_notes: optStr,
  items: z.array(itemSchema).optional().default([]),
});

const storeSchema = z.object({
  slug: optStr,
  name: optStr,
  country: z.string().min(1), // ISO 2 letras
});

export const webhookPayloadSchema = z.object({
  event: z.string().min(1),
  store: storeSchema,
  order: orderSchema,
});

export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;
