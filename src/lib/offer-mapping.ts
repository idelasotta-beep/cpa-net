/**
 * Mapeo producto (EstrategiasIA) → oferta (Adcombo).
 *
 * Clave = `networkOfferId` (offer_id de Adcombo). Valor = `platformProductId`
 * (= el `dropi_product_id` que EstrategiasIA manda en items[].dropi_product_id
 * para ese producto).
 *
 * Al correr `POST /api/admin/offers/sync` se setea `platformProductId` en cada
 * oferta listada acá, para que los leads entrantes resuelvan su `offerId`.
 *
 * La pantalla de administración de la Fase 3 reemplazará este archivo.
 *
 * Ejemplo (descomentar y completar con tus productos reales):
 *   "37167": "12345",  // Adcombo offer 37167 (TurboSlim - CL) ← dropi_product_id 12345
 */
export const OFFER_PRODUCT_MAPPING: Record<string, string> = {
  // networkOfferId: dropiProductId
};
