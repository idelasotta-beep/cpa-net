/**
 * Resolución de la provincia argentina al ID que exige Latinecom (entero 1-24).
 *
 * Wrapper delgado sobre el registro multi-país ([[../geo/countries]]): el catálogo
 * de AR (code→id, label→id) vive ahí como única fuente de verdad. Este módulo
 * conserva la firma histórica del path de Shopify (que siempre es AR/Latinecom):
 * `shipping_address.province_code` (ISO 3166-2, una letra) como fuente primaria y
 * la etiqueta de texto como fallback. Si no se puede resolver, devuelve null (el
 * caller no pushea a la red con provincia inválida).
 */
import { resolveProvinceId as resolveForCountry, normalizeProvince } from "@/lib/geo/countries";

export { normalizeProvince };

/**
 * Devuelve el ID de provincia (1-24) de Latinecom para Argentina, o null.
 * @param provinceCode  shipping_address.province_code (ISO, ej. "M")
 * @param provinceLabel  texto de la provincia (fallback), ej. "Gran Buenos Aires"
 */
export function resolveProvinceId(
  provinceCode: string | null | undefined,
  provinceLabel: string | null | undefined,
): number | null {
  return resolveForCountry("AR", provinceCode, provinceLabel);
}
