import { type CountryCode, parsePhoneNumberFromString } from "libphonenumber-js/max";
import { getCountry } from "@/lib/geo/countries";

/**
 * Validación de teléfono con libphonenumber (metadata `/max` = planes de numeración
 * reales + tipo de línea). Corre en el server (intake); la landing queda liviana.
 *
 * Objetivo: minimizar teléfonos inválidos que la red manda a trash. Valida contra los
 * rangos reales del país (no solo longitud) y detecta móvil/fijo. NO rechaza fijos
 * (el contacto es por llamada). Para AR: si el form agregó el "9" de móvil pero el
 * número es un fijo cuyo 9-formato es inválido, reintenta sin el 9 (arregla ese caso).
 */

export interface PhoneCheck {
  valid: boolean;
  /** Forma canónica en dígitos (sin "+"), ej. "5491134422920". */
  phone: string | null;
  /** MOBILE | FIXED_LINE | FIXED_LINE_OR_MOBILE | ... | null */
  type: string | null;
}

const INVALID: PhoneCheck = { valid: false, phone: null, type: null };

function parseIntl(digits: string) {
  const pn = parsePhoneNumberFromString(`+${digits}`);
  return pn && pn.isValid() ? pn : null;
}

export function checkPhone(iso2: string, raw: string): PhoneCheck {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return INVALID;
  const c = getCountry(iso2);
  const pfx = c.phonePrefix;
  const mp = c.phone.mobilePrefix ?? "";

  // 1) Como viene (el form ya trae el código de país + el "9" de móvil en AR).
  let pn = parseIntl(digits);

  // 2) AR: si con el "9" no valida, puede ser un fijo mal formateado → reintentar sin él.
  if (!pn && mp && digits.startsWith(pfx + mp)) {
    pn = parseIntl(pfx + digits.slice(pfx.length + mp.length));
  }

  // 3) Fallback: como número nacional del país (por si vino sin código de país).
  if (!pn) {
    const p = parsePhoneNumberFromString(digits, iso2 as CountryCode);
    if (p && p.isValid()) pn = p;
  }

  if (!pn) return INVALID;

  // Rechazar todos los dígitos iguales (libphonenumber a veces los da por válidos).
  let local = pn.nationalNumber.toString();
  if (mp && local.startsWith(mp)) local = local.slice(mp.length);
  if (/^(\d)\1+$/.test(local)) return INVALID;

  return { valid: true, phone: pn.number.replace(/^\+/, ""), type: pn.getType() ?? null };
}
