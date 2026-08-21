import { z } from "zod";

/**
 * Payload del webhook de Pancake → POST/GET /api/webhooks/pancake.
 *
 * Pancake manda los campos como query params (pestaña Params) y/o body JSON; el
 * endpoint los mergea antes de validar. Todo llega como string → z.coerce en los números.
 *
 * Meta: Pancake gestiona su propio CAPI HOY (Purchase al cerrar la venta por WhatsApp).
 * Igualmente aceptamos los IDs de Meta como OPCIONALES y los guardamos en el lead, para
 * que —si más adelante se decide que la app dispare el Purchase en la aprobación de la
 * red (mejor señal para COD)— ya estén capturados sin re-tocar la ingesta. El click id de
 * click-to-WhatsApp (ctwa_clid) y ad_id, si vienen, quedan igual en rawPayload.
 */

const optStr = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

export const pancakePayloadSchema = z.object({
  // ID único del pedido/conversación en Pancake → idempotencia (externalId).
  orderId: z.string().trim().min(1),

  // Canal/medio dentro de Pancake (la venta suele cerrarse por WhatsApp).
  channel: z.enum(["whatsapp", "webcake", "manual"]).optional().default("whatsapp"),

  // País ISO2 (default AR).
  countryCode: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length === 2 ? v.toUpperCase() : "AR")),

  // Producto / combo. `sku` mapea a offer.platformProductId (igual que las otras fuentes).
  sku: z.string().trim().min(1),
  quantity: z.coerce.number().int().min(1).default(1),
  totalPriceLocal: z.coerce.number().positive().optional(),

  // Cliente. Solo nombre y teléfono son obligatorios; el resto lo decide la red del país.
  name: z.string().trim().min(1),
  phone: z.string().trim().min(1),
  email: optStr,

  // Dirección. Tolerante: AR/Latinecom exige street+streetNumber+city+postalCode+provinceId;
  // redes de texto aceptan `address`/`province` libres.
  street: optStr,
  streetNumber: optStr,
  address: optStr,
  floor: optStr,
  apartment: optStr,
  betweenStreets: optStr,
  shippingNotes: optStr,
  city: optStr,
  postalCode: optStr,
  provinceId: z.coerce.number().int().positive().optional(),
  province: optStr,
  country: optStr,

  // Meta (opcional; ver nota de cabecera). ctwa_clid/ad_id NO se listan acá a propósito:
  // no tienen columna y se preservan en rawPayload.
  pixelId: optStr,
  fbclid: optStr,
  fbc: optStr,
  fbp: optStr,

  // Tracking.
  utmSource: optStr,
  utmCampaign: optStr,
  utmContent: optStr,
  utmTerm: optStr,
});

export type PancakePayload = z.infer<typeof pancakePayloadSchema>;
