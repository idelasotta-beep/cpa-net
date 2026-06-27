import type { Lead, Offer } from "@prisma/client";

/**
 * Contrato común de una red CPA (patrón adapter multi-red).
 * Adcombo es la primera implementación; sumar otra red = nuevo client + registrarlo.
 */

// Status canónico unificado (cada red traduce su vocabulario a este).
export type CanonicalStatus = "hold" | "lead" | "reject" | "trash";

export interface CreateOrderResult {
  ok: boolean;
  /** ID de la orden en la red (se guarda en lead.networkLeadId). */
  networkLeadId?: string;
  /** La red reporta que ya existía una orden con ese teléfono. */
  isDouble?: boolean;
  error?: string;
}

export interface NetworkStatusResult {
  networkLeadId: string;
  /** "unknown" => no cambiar el estado local. */
  status: CanonicalStatus | "unknown";
  /** Revenue en USD para órdenes confirmadas. */
  revenueUsd?: number;
  /** Nota opcional (extra_state/comment) para el historial. */
  note?: string;
}

/** Oferta normalizada desde el catálogo de la red. */
export interface NormalizedOffer {
  networkOfferId: string;
  name: string;
  country: string;
  payoutUsd: number;
  priceLocal: number;
}

export interface OfferNetworkClient {
  readonly slug: string;
  /** Envía un lead a la red para crear la orden. */
  createOrder(lead: Lead, offer: Offer): Promise<CreateOrderResult>;
  /** Consulta el estado de un lote de órdenes (por networkLeadId). */
  fetchStatuses(networkLeadIds: string[]): Promise<NetworkStatusResult[]>;
  /** Trae el catálogo de ofertas de la red. */
  loadOffers(): Promise<NormalizedOffer[]>;
}
