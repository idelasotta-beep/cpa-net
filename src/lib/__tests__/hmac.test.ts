import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyEstrategasSignature } from "@/lib/hmac";

const secret = "test-secret";
const body = JSON.stringify({ event: "order.created", hello: "world" });

function sign(raw: string, key = secret): string {
  return createHmac("sha256", key).update(raw, "utf8").digest("hex");
}

describe("verifyEstrategasSignature", () => {
  it("acepta una firma válida con prefijo sha256=", () => {
    const header = `sha256=${sign(body)}`;
    expect(verifyEstrategasSignature(body, header, secret)).toBe(true);
  });

  it("acepta una firma válida sin prefijo", () => {
    expect(verifyEstrategasSignature(body, sign(body), secret)).toBe(true);
  });

  it("rechaza una firma inválida", () => {
    const header = `sha256=${sign(body, "otro-secreto")}`;
    expect(verifyEstrategasSignature(body, header, secret)).toBe(false);
  });

  it("rechaza si falta el header", () => {
    expect(verifyEstrategasSignature(body, null, secret)).toBe(false);
    expect(verifyEstrategasSignature(body, undefined, secret)).toBe(false);
  });

  it("rechaza si el secreto está vacío", () => {
    expect(verifyEstrategasSignature(body, sign(body), "")).toBe(false);
  });

  it("rechaza si el body fue alterado", () => {
    const header = `sha256=${sign(body)}`;
    expect(verifyEstrategasSignature(body + "x", header, secret)).toBe(false);
  });

  it("no explota con una firma de longitud distinta (no-hex/corta)", () => {
    expect(verifyEstrategasSignature(body, "sha256=zzzz", secret)).toBe(false);
  });
});
