import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifica la firma HMAC-SHA256 del webhook de EstrategiasIA.
 *
 * La plataforma firma el RAW body (string crudo) y envía el resultado en el
 * header `X-Estrategas-Signature` con formato `sha256=<hex>`.
 *
 * CRÍTICO: verificar contra el raw body, no contra el JSON parseado/re-serializado.
 *
 * @param rawBody  cuerpo crudo del request (await req.text())
 * @param signatureHeader  valor del header X-Estrategas-Signature (puede ser null)
 * @param secret  PLATFORM_WEBHOOK_SECRET
 */
export function verifyEstrategasSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string,
): boolean {
  if (!secret) return false;
  if (!signatureHeader) return false;

  // Acepta "sha256=<hex>" o "<hex>" pelado.
  const received = signatureHeader.startsWith("sha256=")
    ? signatureHeader.slice("sha256=".length)
    : signatureHeader;

  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");

  // timingSafeEqual requiere buffers de igual longitud.
  const receivedBuf = Buffer.from(received, "hex");
  const expectedBuf = Buffer.from(expected, "hex");
  if (receivedBuf.length !== expectedBuf.length) return false;

  return timingSafeEqual(receivedBuf, expectedBuf);
}
