import { describe, expect, it } from "vitest";
import { isOriginAllowed } from "../landing-cors";

describe("isOriginAllowed", () => {
  it("match exacto", () => {
    const allow = ["https://linterna.teleservespa.com"];
    expect(isOriginAllowed("https://linterna.teleservespa.com", allow)).toBe(true);
    expect(isOriginAllowed("https://otra.teleservespa.com", allow)).toBe(false);
    expect(isOriginAllowed("http://linterna.teleservespa.com", allow)).toBe(false); // scheme distinto
  });

  it("comodín *.dominio.com matchea cualquier subdominio pero no el apex", () => {
    const allow = ["*.teleservespa.com"];
    expect(isOriginAllowed("https://linterna.teleservespa.com", allow)).toBe(true);
    expect(isOriginAllowed("https://oferta2.teleservespa.com", allow)).toBe(true);
    expect(isOriginAllowed("http://x.teleservespa.com", allow)).toBe(true); // cualquier scheme
    expect(isOriginAllowed("https://teleservespa.com", allow)).toBe(false); // apex NO
    expect(isOriginAllowed("https://teleservespa.com.evil.com", allow)).toBe(false); // sufijo falso
    expect(isOriginAllowed("https://malo.com", allow)).toBe(false);
  });

  it("comodín con scheme exige ese scheme", () => {
    const allow = ["https://*.teleservespa.com"];
    expect(isOriginAllowed("https://a.teleservespa.com", allow)).toBe(true);
    expect(isOriginAllowed("http://a.teleservespa.com", allow)).toBe(false);
  });

  it("comodín en *.pages.dev", () => {
    const allow = ["*.pages.dev"];
    expect(isOriginAllowed("https://es-linterna-7.pages.dev", allow)).toBe(true);
    expect(isOriginAllowed("https://evil.com", allow)).toBe(false);
  });

  it("mezcla de exactos y comodines", () => {
    const allow = ["https://tienda.com", "*.teleservespa.com"];
    expect(isOriginAllowed("https://tienda.com", allow)).toBe(true);
    expect(isOriginAllowed("https://x.teleservespa.com", allow)).toBe(true);
    expect(isOriginAllowed("https://no.com", allow)).toBe(false);
  });

  it("origen malformado no matchea comodín", () => {
    expect(isOriginAllowed("no-es-url", ["*.teleservespa.com"])).toBe(false);
  });
});
