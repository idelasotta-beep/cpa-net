import { describe, expect, it } from "vitest";
import { resolveProvinceId } from "../shopify-province";

describe("resolveProvinceId", () => {
  it("usa el province_code ISO como fuente primaria", () => {
    expect(resolveProvinceId("M", "Mendoza")).toBe(13);
    expect(resolveProvinceId("P", "Formosa")).toBe(9);
    expect(resolveProvinceId("C", "Ciudad Autónoma de Buenos Aires")).toBe(2);
    expect(resolveProvinceId("B", "Buenos Aires")).toBe(1);
    expect(resolveProvinceId("X", "Córdoba")).toBe(6);
  });

  it("es tolerante a minúsculas y espacios en el code", () => {
    expect(resolveProvinceId(" m ", null)).toBe(13);
  });

  it("cae al label cuando el province_code es null", () => {
    expect(resolveProvinceId(null, "Formosa")).toBe(9);
    expect(resolveProvinceId(undefined, "Santa Fe")).toBe(21);
  });

  it("mapea las 4 variantes de Buenos Aires del dataset de Dropi por label", () => {
    expect(resolveProvinceId(null, "CIUDAD AUTONOMA DE BUENOS AIRES")).toBe(2);
    expect(resolveProvinceId(null, "PROVINCIA DE BUENOS AIRES")).toBe(1);
    expect(resolveProvinceId(null, "Buenos Aires")).toBe(1);
    expect(resolveProvinceId(null, "Gran Buenos Aires")).toBe(1);
  });

  it("normaliza acentos y duplicados del dataset de Dropi", () => {
    expect(resolveProvinceId(null, "Córdoba")).toBe(6);
    expect(resolveProvinceId(null, "Cordoba")).toBe(6);
    expect(resolveProvinceId(null, "Río Negro")).toBe(16);
    expect(resolveProvinceId(null, "Rio Negro")).toBe(16);
  });

  it("devuelve null si no se reconoce (regla de seguridad)", () => {
    expect(resolveProvinceId(null, "Provincia Inexistente")).toBeNull();
    expect(resolveProvinceId(null, null)).toBeNull();
    expect(resolveProvinceId("", "")).toBeNull();
  });
});
