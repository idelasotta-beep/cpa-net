import { Channel, Platform } from "@prisma/client";
import type { IntakePayload } from "./intake-schema";
import { PayloadMappingError } from "./map-payload";
import { resolveProvinceId } from "./shopify-province";

export interface MappedIntakeLead {
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
  quantity: number | null;
  totalPriceLocal: number | null;
  fbp: string | null;
  fbc: string | null;
  fbclid: string | null;
  utmSource: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
}

/** Solo dígitos (Latinecom exige teléfono sin "+" ni espacios). */
function digitsOnly(v: string): string {
  return v.replace(/\D/g, "");
}

/**
 * Mapea el payload del form propio a los campos del lead.
 * @param externalId  id idempotente del submit (submitId o uno generado)
 * @param ip          IP del comprador (de los headers del request)
 */
export function mapIntakePayload(
  p: IntakePayload,
  externalId: string,
  ip: string | null,
): MappedIntakeLead {
  const phone = digitsOnly(p.phone);
  if (!phone) {
    throw new PayloadMappingError("teléfono sin dígitos", "missing_phone");
  }

  // Provincia: preferimos el ID directo del form; si no, resolvemos el texto.
  const provinceId = p.provinceId ?? resolveProvinceId(null, p.province ?? null);

  const customerAddress = [p.street, p.streetNumber].filter(Boolean).join(" ") || null;

  return {
    externalId,
    platform: Platform.landing,
    channel: Channel.landing,
    platformProductId: p.sku,
    customerName: p.name,
    customerPhone: phone,
    customerEmail: p.email ?? null,
    customerAddress,
    customerCity: p.city,
    customerRegion: p.province ?? null,
    customerCountry: p.country,
    customerStreet: p.street,
    customerStreetNumber: p.streetNumber,
    customerPostalCode: p.postalCode,
    customerProvinceId: provinceId,
    customerFloor: p.floor ?? null,
    customerApartment: p.apartment ?? null,
    customerBetweenStreets: p.betweenStreets ?? null,
    customerShippingNotes: p.shippingNotes ?? null,
    customerIp: ip,
    quantity: p.quantity,
    totalPriceLocal: p.totalPriceLocal ?? null,
    fbp: p.fbp ?? null,
    fbc: p.fbc ?? null,
    fbclid: p.fbclid ?? null,
    utmSource: p.utmSource ?? null,
    utmCampaign: p.utmCampaign ?? null,
    utmContent: p.utmContent ?? null,
    utmTerm: p.utmTerm ?? null,
  };
}
