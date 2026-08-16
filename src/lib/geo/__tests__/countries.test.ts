import { describe, expect, it } from "vitest";
import { getCountry, isSupportedCountry, isValidPhone, listCountries, normalizePhone, resolveProvinceId } from "../countries";

describe("getCountry", () => {
  it("devuelve la config de un país soportado", () => {
    expect(getCountry("MX").name).toBe("México");
    expect(getCountry("mx").phonePrefix).toBe("52"); // case-insensitive
  });

  it("cae a Argentina para códigos no soportados o inválidos", () => {
    expect(getCountry("ZZ").iso2).toBe("AR");
    expect(getCountry(null).iso2).toBe("AR");
    expect(getCountry("").iso2).toBe("AR");
  });
});

describe("isSupportedCountry", () => {
  it("distingue soportados de no soportados", () => {
    expect(isSupportedCountry("AR")).toBe(true);
    expect(isSupportedCountry("CL")).toBe(true);
    expect(isSupportedCountry("ZZ")).toBe(false);
    expect(isSupportedCountry(null)).toBe(false);
  });
});

describe("listCountries", () => {
  it("incluye Argentina y varios de LatAm", () => {
    const isos = listCountries().map((c) => c.iso2);
    expect(isos).toContain("AR");
    expect(isos).toContain("MX");
    expect(isos.length).toBeGreaterThanOrEqual(10);
  });
});

describe("resolveProvinceId (multi-país)", () => {
  it("AR: resuelve por código ISO 3166-2", () => {
    expect(resolveProvinceId("AR", "M", null)).toBe(13); // Mendoza
    expect(resolveProvinceId("AR", "C", null)).toBe(2); // CABA
  });

  it("AR: resuelve por etiqueta (con acentos y alias)", () => {
    expect(resolveProvinceId("AR", null, "Córdoba")).toBe(6);
    expect(resolveProvinceId("AR", null, "cordoba")).toBe(6);
    expect(resolveProvinceId("AR", null, "Gran Buenos Aires")).toBe(1);
    expect(resolveProvinceId("AR", null, "CABA")).toBe(2);
  });

  it("AR: devuelve null si no reconoce", () => {
    expect(resolveProvinceId("AR", "ZZ", "Narnia")).toBeNull();
  });

  it("países sin catálogo (texto libre) devuelven null", () => {
    expect(getCountry("MX").provinces).toBeUndefined();
    expect(resolveProvinceId("MX", null, "Jalisco")).toBeNull();
    expect(resolveProvinceId("CO", "X", "Antioquia")).toBeNull();
  });
});

describe("validación de teléfono", () => {
  it("AR: 10 nacionales válido con o sin código de país", () => {
    expect(isValidPhone("AR", "1134422920")).toBe(true); // solo nacional
    expect(isValidPhone("AR", "541134422920")).toBe(true); // con 54, sin 9
    expect(isValidPhone("AR", "5491134422920")).toBe(true); // con 54 y 9
  });

  it("AR: rechaza corto, largo y todos iguales", () => {
    expect(isValidPhone("AR", "541234")).toBe(false);
    expect(isValidPhone("AR", "54113442292012345")).toBe(false);
    expect(isValidPhone("AR", "5491111111111")).toBe(false);
  });

  it("normalizePhone AR agrega el 9 y es idempotente", () => {
    expect(normalizePhone("AR", "541134422920")).toBe("5491134422920"); // agrega 9
    expect(normalizePhone("AR", "5491134422920")).toBe("5491134422920"); // ya lo tiene
    expect(normalizePhone("AR", "01134422920")).toBe("5491134422920"); // 0 troncal
  });

  it("MX: 10 nacionales, sin prefijo móvil", () => {
    expect(isValidPhone("MX", "525512345678")).toBe(true);
    expect(isValidPhone("MX", "5215512345678")).toBe(false); // 11 nacionales
    expect(normalizePhone("MX", "525512345678")).toBe("525512345678");
  });

  it("CL: 9 nacionales", () => {
    expect(isValidPhone("CL", "56912345678")).toBe(true);
    expect(isValidPhone("CL", "5691234")).toBe(false);
  });
});
