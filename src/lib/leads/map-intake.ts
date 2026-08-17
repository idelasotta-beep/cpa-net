import { Channel, Platform } from "@prisma/client";
import { getCountry, resolveProvinceId } from "@/lib/geo/countries";
import type { IntakePayload } from "./intake-schema";
import { PayloadMappingError } from "./map-payload";
import { checkPhone } from "./phone-validation";

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
  landingId: string | null;
  pixelId: string | null;
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
  const digits = digitsOnly(p.phone);
  if (!digits) {
    throw new PayloadMappingError("teléfono sin dígitos", "missing_phone");
  }
  const country = getCountry(p.countryCode);
  // Validación con libphonenumber (planes de numeración reales + tipo). El teléfono es
  // el dato crítico en CPA (inválido → la red lo manda a trash). No rechaza fijos.
  const phoneCheck = checkPhone(country.iso2, digits);
  if (!phoneCheck.valid || !phoneCheck.phone) {
    throw new PayloadMappingError("teléfono inválido para el país", "invalid_phone");
  }
  const phone = phoneCheck.phone;

  // Provincia: preferimos el ID directo del form; si no, resolvemos el texto
  // contra el catálogo del país (países por texto libre devuelven null).
  const provinceId = p.provinceId ?? resolveProvinceId(country.iso2, null, p.province ?? null);

  // Dirección: AR manda street+streetNumber (compuesta); el resto, `address` única.
  const composed = [p.street, p.streetNumber].filter(Boolean).join(" ");
  const customerAddress = composed || p.address || null;

  return {
    externalId,
    platform: Platform.landing,
    channel: Channel.landing,
    platformProductId: p.sku,
    customerName: p.name,
    customerPhone: phone,
    customerEmail: p.email ?? null,
    customerAddress,
    customerCity: p.city ?? null,
    customerRegion: p.province ?? null,
    customerCountry: p.country ?? country.name,
    customerStreet: p.street ?? null,
    customerStreetNumber: p.streetNumber ?? null,
    customerPostalCode: p.postalCode ?? null,
    customerProvinceId: provinceId,
    customerFloor: p.floor ?? null,
    customerApartment: p.apartment ?? null,
    customerBetweenStreets: p.betweenStreets ?? null,
    customerShippingNotes: p.shippingNotes ?? null,
    customerIp: ip,
    quantity: p.quantity,
    totalPriceLocal: p.totalPriceLocal ?? null,
    landingId: p.landingId ?? null,
    pixelId: p.pixelId ?? null,
    fbp: p.fbp ?? null,
    fbc: p.fbc ?? null,
    fbclid: p.fbclid ?? null,
    utmSource: p.utmSource ?? null,
    utmCampaign: p.utmCampaign ?? null,
    utmContent: p.utmContent ?? null,
    utmTerm: p.utmTerm ?? null,
  };
}
