import { adcomboClient } from "./adcombo/client";
import type { OfferNetworkClient } from "./types";

/** Mapea el slug de la red a su client. Sumar red = agregar acá. */
const clients: Record<string, OfferNetworkClient> = {
  adcombo: adcomboClient,
};

export function getNetworkClient(slug: string): OfferNetworkClient | null {
  return clients[slug] ?? null;
}
