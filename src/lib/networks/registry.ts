import { adcomboClient } from "./adcombo/client";
import { ecomlatamClient } from "./ecomlatam/client";
import { latinleadsClient } from "./latinleads/client";
import type { OfferNetworkClient } from "./types";

/** Mapea el slug de la red a su client. Sumar red = agregar acá. */
const clients: Record<string, OfferNetworkClient> = {
  adcombo: adcomboClient,
  latinleads: latinleadsClient,
  ecomlatam: ecomlatamClient,
};

export function getNetworkClient(slug: string): OfferNetworkClient | null {
  return clients[slug] ?? null;
}
