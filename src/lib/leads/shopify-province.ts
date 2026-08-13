/**
 * Resolución de la provincia argentina al ID que exige EcomLatam (entero 1-24).
 *
 * Fuente primaria: `shipping_address.province_code` de Shopify = código ISO 3166-2
 * (una letra), estandarizado y sin problemas de acentos/tipeo.
 * Fallback: la etiqueta de texto de la provincia (viene del dataset de Dropi, con
 * variantes como "Gran Buenos Aires" que Shopify NO reconoce → province_code null).
 *
 * Regla de seguridad: si no se puede resolver, devolver null. El caller decide
 * (no se pushea a la red con provincia inválida).
 */

// Código ISO 3166-2:AR (letra) → ID de provincia de EcomLatam.
const CODE_TO_ID: Record<string, number> = {
  A: 17, // Salta
  B: 1, // Buenos Aires (provincia)
  C: 2, // CABA
  D: 19, // San Luis
  E: 8, // Entre Ríos
  F: 12, // La Rioja
  G: 22, // Santiago del Estero
  H: 4, // Chaco
  J: 18, // San Juan
  K: 3, // Catamarca
  L: 11, // La Pampa
  M: 13, // Mendoza
  N: 14, // Misiones
  P: 9, // Formosa
  Q: 15, // Neuquén
  R: 16, // Río Negro
  S: 21, // Santa Fe
  T: 24, // Tucumán
  U: 5, // Chubut
  V: 23, // Tierra del Fuego
  W: 7, // Corrientes
  X: 6, // Córdoba
  Y: 10, // Jujuy
  Z: 20, // Santa Cruz
};

// Etiqueta normalizada (sin acentos, minúsculas) → ID de EcomLatam.
// Cubre las variantes del dataset de Dropi, incluidas las 4 de Buenos Aires.
const LABEL_TO_ID: Record<string, number> = {
  "ciudad autonoma de buenos aires": 2,
  "provincia de buenos aires": 1,
  "buenos aires": 1,
  "gran buenos aires": 1,
  catamarca: 3,
  chaco: 4,
  chubut: 5,
  cordoba: 6,
  corrientes: 7,
  "entre rios": 8,
  formosa: 9,
  jujuy: 10,
  "la pampa": 11,
  "la rioja": 12,
  mendoza: 13,
  misiones: 14,
  neuquen: 15,
  "rio negro": 16,
  salta: 17,
  "san juan": 18,
  "san luis": 19,
  "santa cruz": 20,
  "santa fe": 21,
  "santiago del estero": 22,
  "tierra del fuego": 23,
  tucuman: 24,
};

/** minúsculas + trim + sin diacríticos (acentos). */
export function normalizeProvince(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/**
 * Devuelve el ID de provincia (1-24) de EcomLatam, o null si no se reconoce.
 * @param provinceCode  shipping_address.province_code (ISO, ej. "M")
 * @param provinceLabel  texto de la provincia (fallback), ej. "Gran Buenos Aires"
 */
export function resolveProvinceId(
  provinceCode: string | null | undefined,
  provinceLabel: string | null | undefined,
): number | null {
  const code = provinceCode?.trim().toUpperCase();
  if (code && CODE_TO_ID[code] != null) return CODE_TO_ID[code];

  if (provinceLabel) {
    const id = LABEL_TO_ID[normalizeProvince(provinceLabel)];
    if (id != null) return id;
  }
  return null;
}
