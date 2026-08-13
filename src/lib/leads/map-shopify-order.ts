import { Channel, Platform } from "@prisma/client";
import { PayloadMappingError } from "./map-payload";
import { resolveProvinceId } from "./shopify-province";
import type { ShopifyOrder } from "./shopify-webhook-schema";

/**
 * Nombres EXACTOS de los campos custom del form COD de Releasit tal como llegan
 * en `note_attributes` (confirmado contra el JSON crudo del webhook, 2026-08-12).
 */
const NOTE = {
  name: "Nombre completo",
  street: "Calle",
  streetNumber: "Número",
  floor: "Piso y Timbre",
  betweenStreets: "Referencia del Domicilio",
  province: "Provincia",
  city: "Ciudad",
  postalCode: "Código postal",
  phone: "Teléfono con Whatsapp",
  email: "Correo electrónico",
  ip: "IP address",
} as const;

export interface MappedShopifyLead {
  externalId: string;
  platform: Platform;
  channel: Channel;
  platformProductId: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  customerAddress: string | null;
  customerCity: string | null;
  customerRegion: string | null;
  customerCountry: string;
  customerStreet: string | null;
  customerStreetNumber: string | null;
  customerPostalCode: string | null;
  customerProvinceId: number | null;
  customerFloor: string | null;
  customerApartment: string | null;
  customerBetweenStreets: string | null;
  customerShippingNotes: string | null;
  customerIp: string | null;
}

function clean(v: string | number | boolean | null | undefined): string | null {
  if (v === undefined || v === null) return null;
  const t = String(v).trim();
  return t.length === 0 ? null : t;
}

/** Primer valor no vacío de la lista. */
function firstOf(...vals: Array<string | number | boolean | null | undefined>): string | null {
  for (const v of vals) {
    const c = clean(v);
    if (c !== null) return c;
  }
  return null;
}

/** Solo dígitos (EcomLatam exige teléfono sin "+" ni espacios). */
function digitsOnly(v: string | null): string | null {
  if (v === null) return null;
  const d = v.replace(/\D/g, "");
  return d.length === 0 ? null : d;
}

/**
 * Normaliza una orden de Shopify (form COD de Releasit) a los campos del lead.
 * Toma los campos base del `shipping_address` estándar y los extras de
 * `note_attributes`. Lanza PayloadMappingError si falta nombre o teléfono.
 */
export function mapShopifyOrder(order: ShopifyOrder): MappedShopifyLead {
  const notes = new Map<string, string>();
  for (const a of order.note_attributes) {
    const val = clean(a.value);
    if (val !== null) notes.set(a.name, val);
  }
  const note = (key: string): string | null => notes.get(key) ?? null;

  const shipping = order.shipping_address ?? order.billing_address ?? null;

  const customerName = firstOf(shipping?.name, note(NOTE.name));
  if (!customerName) {
    throw new PayloadMappingError("orden sin nombre de cliente", "missing_name");
  }

  const customerPhone = digitsOnly(
    firstOf(order.phone, shipping?.phone, note(NOTE.phone)),
  );
  if (!customerPhone) {
    throw new PayloadMappingError("orden sin teléfono", "missing_phone");
  }

  const customerStreet = firstOf(shipping?.address1, note(NOTE.street));
  const customerStreetNumber = firstOf(shipping?.address2, note(NOTE.streetNumber));
  const provinceLabel = firstOf(shipping?.province, note(NOTE.province));
  const customerAddress =
    [customerStreet, customerStreetNumber].filter(Boolean).join(" ") || null;

  return {
    externalId: order.id,
    platform: Platform.shopify,
    channel: Channel.shopify,
    platformProductId: firstOf(order.line_items[0]?.sku),
    customerName,
    customerPhone,
    customerEmail: firstOf(order.email, order.contact_email, note(NOTE.email)),
    customerAddress,
    customerCity: firstOf(shipping?.city, note(NOTE.city)),
    customerRegion: provinceLabel,
    customerCountry: firstOf(shipping?.country) ?? "Argentina",
    customerStreet,
    customerStreetNumber,
    customerPostalCode: firstOf(shipping?.zip, note(NOTE.postalCode)),
    customerProvinceId: resolveProvinceId(shipping?.province_code, provinceLabel),
    customerFloor: note(NOTE.floor),
    customerApartment: null,
    customerBetweenStreets: note(NOTE.betweenStreets),
    customerShippingNotes: clean(order.note),
    customerIp: note(NOTE.ip),
  };
}
