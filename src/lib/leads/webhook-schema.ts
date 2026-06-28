import { z } from "zod";

/**
 * Schema del payload del webhook `order.created` de EstrategiasIA.
 *
 * Estructura confirmada contra el JSON crudo real (2026-06-28):
 *  - `order.shipping` y `order.utm` son OBJETOS ANIDADOS (no claves planas).
 *  - EstrategiasIA envía `null` en los campos vacíos → opcionales usan `.nullish()`.
 */

// String opcional tolerante a null.
const optStr = z.string().nullish();

// Número opcional tolerante a null.
const optNum = z.coerce.number().nullish();

// Acepta string | number | null | undefined y normaliza a string | null.
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
  phone_2: optStr,
  phone_3: optStr,
  email: optStr,
  dni: optStr,
});

const shippingSchema = z
  .object({
    address: optStr,
    city: optStr,
    state: optStr,
    zip_code: optStr,
    notes: optStr,
    neighborhood: optStr,
  })
  .nullish();

const utmSchema = z
  .object({
    source: optStr,
    medium: optStr,
    campaign: optStr,
    content: optStr,
    term: optStr,
  })
  .nullish();

const orderSchema = z.object({
  number: z.coerce.string().min(1),
  created_at: optStr,
  created_via: z.string().min(1),
  currency: optStr,
  status: optStr,
  payment_method: optStr,
  notes: optStr,
  total: optNum,
  subtotal: optNum,
  discount: optNum,
  shipping_cost: optNum,
  customer: customerSchema,
  shipping: shippingSchema,
  utm: utmSchema,
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
