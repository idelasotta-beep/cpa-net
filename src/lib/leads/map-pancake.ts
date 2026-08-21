import { Channel, Platform } from "@prisma/client";
import { getCountry, resolveProvinceId } from "@/lib/geo/countries";
import { PayloadMappingError } from "./map-payload";
import type { PancakePayload } from "./pancake-schema";
import { checkPhone } from "./phone-validation";

/**
 * Mapea el payload del webhook de Pancake a los campos del lead.
 * platform = pancake; channel = whatsapp|webcake|manual (default whatsapp).
 * Reusa los helpers de país/provincia/teléfono compartidos con el intake.
 */

export interface MappedPancakeLead {
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
  quantity: number | null;
  totalPriceLocal: number | null;
  pixelId: string | null;
  fbp: string | null;
  fbc: string | null;
  fbclid: string | null;
  utmSource: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
}

/** Solo dígitos (las redes COD exigen teléfono sin "+" ni espacios). */
function digitsOnly(v: string): string {
  return v.replace(/\D/g, "");
}

const CHANNELS: Record<PancakePayload["channel"], Channel> = {
  whatsapp: Channel.whatsapp,
  webcake: Channel.webcake,
  manual: Channel.manual,
};

export function mapPancakePayload(p: PancakePayload): MappedPancakeLead {
  const digits = digitsOnly(p.phone);
  if (!digits) {
    throw new PayloadMappingError("teléfono sin dígitos", "missing_phone");
  }
  const country = getCountry(p.countryCode);
  // Validación con libphonenumber (igual que el intake): teléfono inválido → la red lo
  // manda a trash. No rechaza fijos.
  const phoneCheck = checkPhone(country.iso2, digits);
  if (!phoneCheck.valid || !phoneCheck.phone) {
    throw new PayloadMappingError("teléfono inválido para el país", "invalid_phone");
  }
  const phone = phoneCheck.phone;

  // Provincia: ID directo si viene; si no, resolver el texto contra el catálogo del país.
  const provinceId = p.provinceId ?? resolveProvinceId(country.iso2, null, p.province ?? null);

  // Dirección: AR manda street+streetNumber (compuesta); el resto, `address` única.
  const composed = [p.street, p.streetNumber].filter(Boolean).join(" ");
  const customerAddress = composed || p.address || null;

  return {
    externalId: p.orderId,
    platform: Platform.pancake,
    channel: CHANNELS[p.channel] ?? Channel.whatsapp,
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
    quantity: p.quantity,
    totalPriceLocal: p.totalPriceLocal ?? null,
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
