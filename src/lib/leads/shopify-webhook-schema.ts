import { z } from "zod";

/**
 * Schema del payload del webhook `orders/create` de Shopify.
 *
 * Shopify postea el objeto orden directo (sin envoltorio). Validamos de forma
 * TOLERANTE: solo lo que usamos, todo lo demás pasa. Los campos de dirección
 * llegan por dos vías (usamos ambas en el mapper):
 *  - `shipping_address` estándar (incluye `province_code` ISO) → campos base.
 *  - `note_attributes` (campos custom del form COD de Releasit) → extras.
 */

const optStr = z.string().nullish();
const optNum = z.coerce.number().nullish();

// Acepta string | number | null → string | null (para ids numéricos de Shopify).
const idLike = z
  .union([z.string(), z.number()])
  .nullish()
  .transform((v) => (v === undefined || v === null ? null : String(v).trim()));

const noteAttributeSchema = z.object({
  name: z.string(),
  value: z.union([z.string(), z.number(), z.boolean()]).nullish(),
});

const addressSchema = z
  .object({
    name: optStr,
    first_name: optStr,
    last_name: optStr,
    address1: optStr,
    address2: optStr,
    city: optStr,
    zip: optStr,
    province: optStr,
    province_code: optStr,
    country: optStr,
    country_code: optStr,
    phone: optStr,
  })
  .nullish();

const lineItemSchema = z.object({
  sku: optStr,
  quantity: optNum,
  price: optStr,
  product_id: idLike,
  variant_id: idLike,
  name: optStr,
});

export const shopifyOrderSchema = z.object({
  id: z.union([z.string(), z.number()]).transform((v) => String(v)),
  app_id: idLike,
  source_name: optStr,
  name: optStr, // ej. "GG1003"
  order_number: optNum,
  email: optStr,
  contact_email: optStr,
  phone: optStr,
  currency: optStr,
  total_price: optStr,
  note: optStr,
  note_attributes: z.array(noteAttributeSchema).optional().default([]),
  shipping_address: addressSchema,
  billing_address: addressSchema,
  line_items: z.array(lineItemSchema).optional().default([]),
});

export type ShopifyOrder = z.infer<typeof shopifyOrderSchema>;
