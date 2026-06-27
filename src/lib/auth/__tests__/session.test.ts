import { describe, expect, it } from "vitest";
import { createSessionToken, verifySessionToken } from "@/lib/auth/session";

describe("session (jose)", () => {
  it("firma y verifica un token válido", async () => {
    const token = await createSessionToken("user@example.com");
    expect(await verifySessionToken(token)).toEqual({ email: "user@example.com" });
  });

  it("rechaza un token inválido", async () => {
    expect(await verifySessionToken("no-soy-un-jwt")).toBeNull();
  });

  it("rechaza token vacío/ausente", async () => {
    expect(await verifySessionToken(undefined)).toBeNull();
    expect(await verifySessionToken(null)).toBeNull();
    expect(await verifySessionToken("")).toBeNull();
  });
});
