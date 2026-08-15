import { describe, expect, it } from "vitest";
import { getCountry, isSupportedCountry, listCountries, resolveProvinceId } from "../countries";

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
