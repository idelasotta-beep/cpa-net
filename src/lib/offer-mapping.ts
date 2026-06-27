/**
 * Overrides OPCIONALES del mapeo producto→oferta.
 *
 * Convención por defecto: en EstrategiasIA el `dropi_product_id` se setea IGUAL al
 * `offer_id` de Adcombo, así que el sync ya asigna `platformProductId = networkOfferId`
 * en todas las ofertas automáticamente. No hace falta cargar nada acá.
 *
 * Este archivo solo sirve para EXCEPCIONES: si para una oferta el dropi_product_id que
 * manda EstrategiasIA NO coincide con el offer_id de Adcombo, ponelo acá.
 *   Clave = networkOfferId (offer_id Adcombo), Valor = platformProductId (dropi_product_id).
 *   Ej: "37167": "99999"
 */
export const OFFER_PRODUCT_MAPPING: Record<string, string> = {
  // networkOfferId: dropiProductId (solo excepciones)
};
