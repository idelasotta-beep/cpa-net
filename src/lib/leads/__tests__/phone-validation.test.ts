import { describe, expect, it } from "vitest";
import { checkPhone } from "../phone-validation";

describe("checkPhone (libphonenumber)", () => {
  it("AR móvil válido (con 9): MOBILE", () => {
    const r = checkPhone("AR", "5491134422920");
    expect(r.valid).toBe(true);
    expect(r.phone).toBe("5491134422920");
    expect(r.type).toBe("MOBILE");
  });

  it("AR fijo válido (sin 9): FIXED_LINE, se mantiene sin 9", () => {
    const r = checkPhone("AR", "541134422920");
    expect(r.valid).toBe(true);
    expect(r.phone).toBe("541134422920");
    expect(r.type).toBe("FIXED_LINE");
  });

  it("rechaza plan inválido con longitud OK (0000…)", () => {
    expect(checkPhone("AR", "5490000000000").valid).toBe(false);
  });

  it("rechaza corto y largo", () => {
    expect(checkPhone("AR", "5491234").valid).toBe(false);
    expect(checkPhone("AR", "54938145725000").valid).toBe(false);
  });

  it("rechaza todos los dígitos iguales", () => {
    expect(checkPhone("AR", "5491111111111").valid).toBe(false);
  });

  it("MX válido", () => {
    const r = checkPhone("MX", "525512345678");
    expect(r.valid).toBe(true);
    expect(r.phone).toBe("525512345678");
  });

  it("teléfono vacío => inválido", () => {
    expect(checkPhone("AR", "").valid).toBe(false);
  });
});
