import { createHash } from "node:crypto";
import rangesJson from "./geo-ip-ranges.json";

/**
 * Generación de una IP pública "geolocalizada" al país de la oferta.
 *
 * Contexto: EstrategiasIA no envía la IP del cliente, pero Adcombo la exige en
 * `order/create` solo como validación de que la compra es del país de la oferta.
 * Solución: generar una IP pública aleatoria que cae en un rango asignado al país,
 * de forma DETERMINÍSTICA a partir de un seed (= lead.id) → la misma IP en cada
 * reintento del mismo lead, estadísticamente única entre leads, y nunca en rangos
 * privados/reservados (los datasets son asignaciones públicas por país).
 */

const ranges = rangesJson as Record<string, string[]>;

// Rangos prohibidos por Adcombo (privados/reservados). Belt-and-suspenders: los
// datasets por país ya son públicos, pero igual validamos.
const FORBIDDEN_CIDRS = [
  "0.0.0.0/8",
  "10.0.0.0/8",
  "100.64.0.0/10",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "172.16.0.0/12",
  "192.0.0.0/29",
  "192.0.2.0/24",
  "192.88.99.0/24",
  "192.168.0.0/16",
  "198.18.0.0/15",
  "198.51.100.0/24",
  "203.0.113.0/24",
  "224.0.0.0/4",
  "239.0.0.0/8",
  "240.0.0.0/4",
  "255.255.255.255/32",
];

export function isCountrySupported(country: string): boolean {
  return Boolean(ranges[country.trim().toUpperCase()]?.length);
}

export function ipToInt(ip: string): number {
  const parts = ip.split(".").map(Number);
  return (
    ((parts[0]! << 24) >>> 0) +
    (parts[1]! << 16) +
    (parts[2]! << 8) +
    parts[3]!
  ) >>> 0;
}

export function intToIp(n: number): string {
  return [
    (n >>> 24) & 0xff,
    (n >>> 16) & 0xff,
    (n >>> 8) & 0xff,
    n & 0xff,
  ].join(".");
}

/** Devuelve [baseInt, size] de un CIDR "a.b.c.d/p". */
function parseCidr(cidr: string): { base: number; size: number } {
  const [ip, prefixStr] = cidr.split("/");
  const prefix = Number(prefixStr);
  const size = 2 ** (32 - prefix);
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const base = (ipToInt(ip!) & mask) >>> 0;
  return { base, size };
}

const FORBIDDEN_PARSED = FORBIDDEN_CIDRS.map(parseCidr);

function isForbidden(ipInt: number): boolean {
  return FORBIDDEN_PARSED.some(
    ({ base, size }) => ipInt >= base && ipInt < base + size,
  );
}

/** uint32 determinístico derivado de (seed, salt). */
function prand(seed: string, salt: number): number {
  const h = createHash("sha256").update(`${seed}:${salt}`).digest();
  return h.readUInt32BE(0);
}

/**
 * Genera una IP pública en el país dado, determinística según `seed`.
 * @throws si no hay dataset de rangos para el país (no inventamos IP fuera de país).
 */
export function generateIpForCountry(country: string, seed: string): string {
  const cc = country.trim().toUpperCase();
  const cidrs = ranges[cc];
  if (!cidrs || cidrs.length === 0) {
    throw new Error(`Sin rangos IP para el país "${cc}" (geo-ip-ranges.json)`);
  }

  // Hasta N intentos determinísticos por si cae en red/broadcast o forbidden.
  for (let attempt = 0; attempt < 8; attempt++) {
    const cidr = cidrs[prand(seed, attempt * 2) % cidrs.length]!;
    const { base, size } = parseCidr(cidr);

    let ipInt: number;
    if (size <= 2) {
      ipInt = base; // /31 o /32: usar la base
    } else {
      // host entre 1 y size-2 (evita red y broadcast)
      const offset = 1 + (prand(seed, attempt * 2 + 1) % (size - 2));
      ipInt = (base + offset) >>> 0;
    }

    if (!isForbidden(ipInt)) return intToIp(ipInt);
  }

  // Fallback extremadamente improbable: primera IP usable del primer rango.
  const { base, size } = parseCidr(cidrs[0]!);
  return intToIp(size > 2 ? (base + 1) >>> 0 : base);
}
