import { z } from "zod";

/**
 * Schema del payload del webhook `order.created` de EstrategiasIA.
 *
 * Estructura inferida del payload real capturado (ver memoria del proyecto).
 * Es tolerante: solo exige lo imprescindible para crear un lead; el resto es
 * opcional. Si al ver el raw body real difieren las claves, ajustar aquí.
 */

// Acepta string o número y normaliza a string (ej. dropi_product_id "56579" / 56579).
const idLike = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim())
  .optional();

const itemSchema = z.object({
  product_name: z.string().optional(),
  variant_name: z.string().optional(),
  quantity: z.coerce.number().optional(),
  unit_price: z.coerce.number().optional(),
  total_price: z.coerce.number().optional(),
  dropi_product_id: idLike,
  dropi_variation_id: idLike,
});

const customerSchema = z.object({
  name: z.string().min(1),
  surname: z.string().optional().default(""),
  phone: z.string().min(1),
  phone2: z.string().optional(),
  phone3: z.string().optional(),
  email: z.string().optional(),
  dni: z.string().optional(),
});

const orderSchema = z.object({
  number: z.coerce.string().min(1),
  created_at: z.string().optional(),
  created_via: z.string().min(1),
  currency: z.string().optional(),
  status: z.string().optional(),
  payment_method: z.string().optional(),
  total: z.coerce.number().optional(),
  subtotal: z.coerce.number().optional(),
  discount: z.coerce.number().optional(),
  shipping_cost: z.coerce.number().optional(),
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
  utm_content: z.string().optional(),
  utm_term: z.string().optional(),
  customer: customerSchema,
  shipping_address: z.string().optional(),
  shipping_city: z.string().optional(),
  shipping_state: z.string().optional(),
  shipping_neighborhood: z.string().optional(),
  shipping_zip_code: z.string().optional(),
  shipping_notes: z.string().optional(),
  items: z.array(itemSchema).optional().default([]),
});

const storeSchema = z.object({
  slug: z.string().optional(),
  name: z.string().optional(),
  country: z.string().min(1), // ISO 2 letras
});

export const webhookPayloadSchema = z.object({
  event: z.string().min(1),
  store: storeSchema,
  order: orderSchema,
});

export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;
