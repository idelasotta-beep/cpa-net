/**
 * Registro de países para las landings propias multi-país.
 *
 * Cada país aporta lo que el form y el intake necesitan para operar sin hardcodear
 * Argentina: prefijo telefónico, moneda y — solo si la red de fulfillment de ese país
 * exige un ID de provincia estructurado — el catálogo de provincias.
 *
 * Regla de diseño: el `provinceId` estructurado es requisito de redes COD como
 * Latinecom (AR). Las redes push (Adcombo/Latinleads) reciben la provincia como
 * texto libre. Por eso un país SIN `provinces` es válido: el form usa un campo de
 * texto y el lead guarda la región como texto (customerRegion), sin provinceId.
 */

export interface Province {
  /** ID que exige la red de fulfillment del país (ej. Latinecom 1-24 en AR). */
  id: number;
  name: string;
  /** Código ISO 3166-2 (letra en AR), usado por el webhook de Shopify. */
  code?: string;
}

/** Regla de validación del número nacional (sin código de país). */
export interface PhoneRule {
  /** Mínimo de dígitos del número nacional. */
  min: number;
  /** Máximo de dígitos del número nacional. */
  max: number;
  /** Dígito(s) a insertar entre código de país y nacional para móviles (AR: "9" de WhatsApp). */
  mobilePrefix?: string;
}

export interface CountryConfig {
  /** ISO 3166-1 alpha-2 (mayúsculas). */
  iso2: string;
  /** Nombre para mostrar / guardar en customerCountry. */
  name: string;
  /** Prefijo telefónico internacional sin "+" (ej. "54"). */
  phonePrefix: string;
  /** Regla de validación del teléfono (longitud nacional + prefijo móvil). */
  phone: PhoneRule;
  /** Mínimo de dígitos del número nacional (validación del form). */
  phoneMinDigits: number;
  /** Símbolo de moneda para el form (ej. "$", "S/"). */
  currencySymbol: string;
  /** ISO 4217 (ej. "ARS"). */
  currencyCode: string;
  /**
   * Catálogo de provincias con ID estructurado. Presente solo si el país tiene una
   * red de fulfillment que exige provinceId. Ausente ⇒ el form usa texto libre.
   */
  provinces?: Province[];
}

// ── Argentina (Latinecom COD, provinceId 1-24) ─────────────────────────────
// Catálogo validado en producción (leads aterrizan en la provincia correcta).
const AR_PROVINCES: Province[] = [
  { id: 1, name: "Buenos Aires", code: "B" },
  { id: 2, name: "Ciudad Autónoma de Buenos Aires", code: "C" },
  { id: 3, name: "Catamarca", code: "K" },
  { id: 4, name: "Chaco", code: "H" },
  { id: 5, name: "Chubut", code: "U" },
  { id: 6, name: "Córdoba", code: "X" },
  { id: 7, name: "Corrientes", code: "W" },
  { id: 8, name: "Entre Ríos", code: "E" },
  { id: 9, name: "Formosa", code: "P" },
  { id: 10, name: "Jujuy", code: "Y" },
  { id: 11, name: "La Pampa", code: "L" },
  { id: 12, name: "La Rioja", code: "F" },
  { id: 13, name: "Mendoza", code: "M" },
  { id: 14, name: "Misiones", code: "N" },
  { id: 15, name: "Neuquén", code: "Q" },
  { id: 16, name: "Río Negro", code: "R" },
  { id: 17, name: "Salta", code: "A" },
  { id: 18, name: "San Juan", code: "J" },
  { id: 19, name: "San Luis", code: "D" },
  { id: 20, name: "Santa Cruz", code: "Z" },
  { id: 21, name: "Santa Fe", code: "S" },
  { id: 22, name: "Santiago del Estero", code: "G" },
  { id: 23, name: "Tierra del Fuego", code: "V" },
  { id: 24, name: "Tucumán", code: "T" },
];

/**
 * Variantes de etiqueta (además del name canónico) que el dataset de Dropi / el
 * usuario pueden mandar y deben resolver al mismo ID. Se combinan con los names.
 */
const AR_LABEL_ALIASES: Record<string, number> = {
  "provincia de buenos aires": 1,
  "gran buenos aires": 1,
  "ciudad autonoma de buenos aires": 2,
  caba: 2,
  "capital federal": 2,
};

const COUNTRIES: Record<string, CountryConfig> = {
  AR: {
    iso2: "AR",
    name: "Argentina",
    phonePrefix: "54",
    phone: { min: 10, max: 10, mobilePrefix: "9" }, // móvil AR: 54 9 <área+número> para WhatsApp
    phoneMinDigits: 10,
    currencySymbol: "$",
    currencyCode: "ARS",
    provinces: AR_PROVINCES,
  },
  MX: { iso2: "MX", name: "México", phonePrefix: "52", phone: { min: 10, max: 10 }, phoneMinDigits: 10, currencySymbol: "$", currencyCode: "MXN" },
  CO: { iso2: "CO", name: "Colombia", phonePrefix: "57", phone: { min: 10, max: 10 }, phoneMinDigits: 10, currencySymbol: "$", currencyCode: "COP" },
  CL: { iso2: "CL", name: "Chile", phonePrefix: "56", phone: { min: 9, max: 9 }, phoneMinDigits: 9, currencySymbol: "$", currencyCode: "CLP" },
  PE: { iso2: "PE", name: "Perú", phonePrefix: "51", phone: { min: 9, max: 9 }, phoneMinDigits: 9, currencySymbol: "S/", currencyCode: "PEN" },
  EC: { iso2: "EC", name: "Ecuador", phonePrefix: "593", phone: { min: 9, max: 10 }, phoneMinDigits: 9, currencySymbol: "$", currencyCode: "USD" },
  BO: { iso2: "BO", name: "Bolivia", phonePrefix: "591", phone: { min: 8, max: 8 }, phoneMinDigits: 8, currencySymbol: "Bs", currencyCode: "BOB" },
  PY: { iso2: "PY", name: "Paraguay", phonePrefix: "595", phone: { min: 9, max: 9 }, phoneMinDigits: 9, currencySymbol: "₲", currencyCode: "PYG" },
  UY: { iso2: "UY", name: "Uruguay", phonePrefix: "598", phone: { min: 8, max: 9 }, phoneMinDigits: 8, currencySymbol: "$", currencyCode: "UYU" },
  GT: { iso2: "GT", name: "Guatemala", phonePrefix: "502", phone: { min: 8, max: 8 }, phoneMinDigits: 8, currencySymbol: "Q", currencyCode: "GTQ" },
  CR: { iso2: "CR", name: "Costa Rica", phonePrefix: "506", phone: { min: 8, max: 8 }, phoneMinDigits: 8, currencySymbol: "₡", currencyCode: "CRC" },
  PA: { iso2: "PA", name: "Panamá", phonePrefix: "507", phone: { min: 8, max: 8 }, phoneMinDigits: 8, currencySymbol: "$", currencyCode: "USD" },
  DO: { iso2: "DO", name: "República Dominicana", phonePrefix: "1", phone: { min: 10, max: 10 }, phoneMinDigits: 10, currencySymbol: "$", currencyCode: "DOP" },
};

const DEFAULT_COUNTRY = "AR";

/** Normaliza ISO2 (mayúsculas, trim). Devuelve "" si no es válido. */
function normIso2(iso2: string | null | undefined): string {
  const v = (iso2 ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(v) ? v : "";
}

/** Config del país; cae a Argentina si el código no está soportado. */
export function getCountry(iso2: string | null | undefined): CountryConfig {
  return COUNTRIES[normIso2(iso2)] ?? COUNTRIES[DEFAULT_COUNTRY]!;
}

/** ¿El código corresponde a un país soportado? */
export function isSupportedCountry(iso2: string | null | undefined): boolean {
  return Boolean(COUNTRIES[normIso2(iso2)]);
}

/** Lista de países soportados (para selectores en el generador). */
export function listCountries(): CountryConfig[] {
  return Object.values(COUNTRIES);
}

/** minúsculas + trim + sin diacríticos (acentos). */
export function normalizeProvince(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

// Índices por país (lazy) para resolver code/label → id.
const indexCache = new Map<string, { byCode: Record<string, number>; byLabel: Record<string, number> }>();

function provinceIndex(country: CountryConfig): { byCode: Record<string, number>; byLabel: Record<string, number> } {
  const cached = indexCache.get(country.iso2);
  if (cached) return cached;
  const byCode: Record<string, number> = {};
  const byLabel: Record<string, number> = {};
  for (const p of country.provinces ?? []) {
    if (p.code) byCode[p.code.toUpperCase()] = p.id;
    byLabel[normalizeProvince(p.name)] = p.id;
  }
  if (country.iso2 === "AR") Object.assign(byLabel, AR_LABEL_ALIASES);
  const idx = { byCode, byLabel };
  indexCache.set(country.iso2, idx);
  return idx;
}

/**
 * Resuelve la provincia al ID estructurado del país, o null si no aplica/no se
 * reconoce. Países sin catálogo (provincia por texto) devuelven siempre null.
 * @param iso2   país (ISO2). Cae a AR si no está soportado.
 * @param code   código ISO 3166-2 (ej. "M" en AR) — fuente preferida.
 * @param label  texto de la provincia (fallback).
 */
export function resolveProvinceId(
  iso2: string | null | undefined,
  code: string | null | undefined,
  label: string | null | undefined,
): number | null {
  const country = getCountry(iso2);
  if (!country.provinces) return null; // país por texto libre
  const { byCode, byLabel } = provinceIndex(country);

  const c = code?.trim().toUpperCase();
  if (c && byCode[c] != null) return byCode[c];

  if (label) {
    const id = byLabel[normalizeProvince(label)];
    if (id != null) return id;
  }
  return null;
}

/**
 * Número nacional (sin código de país ni 0 troncal ni prefijo móvil), a partir de
 * los dígitos crudos del teléfono. Base para validar la longitud del país.
 */
function nationalPart(iso2: string | null | undefined, digits: string): string {
  const c = getCountry(iso2);
  let d = String(digits).replace(/\D/g, "");
  if (c.phonePrefix && d.startsWith(c.phonePrefix)) d = d.slice(c.phonePrefix.length);
  d = d.replace(/^0+/, ""); // 0 troncal
  const mp = c.phone.mobilePrefix;
  if (mp && d.startsWith(mp) && d.length === c.phone.max + mp.length) d = d.slice(mp.length);
  return d;
}

/** ¿El teléfono es válido para el país? (longitud nacional + no todo el mismo dígito) */
export function isValidPhone(iso2: string | null | undefined, digits: string): boolean {
  const nat = nationalPart(iso2, digits);
  if (!nat || /^(\d)\1+$/.test(nat)) return false; // vacío o todos iguales (0000…, 1111…)
  const rule = getCountry(iso2).phone;
  return nat.length >= rule.min && nat.length <= rule.max;
}

/**
 * Forma canónica para almacenar/enviar: código de país + prefijo móvil (AR: "9" para
 * WhatsApp) + número nacional. Idempotente si el número ya viene con el 9.
 */
export function normalizePhone(iso2: string | null | undefined, digits: string): string {
  const c = getCountry(iso2);
  let nat = nationalPart(iso2, digits);
  const mp = c.phone.mobilePrefix;
  if (mp && nat.length === c.phone.max) nat = mp + nat; // agrega el 9 (AR) para WhatsApp
  return c.phonePrefix + nat;
}
