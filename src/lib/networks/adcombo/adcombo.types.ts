/** Tipos de las respuestas de la API de Adcombo (los campos que usamos). */

export interface AdcomboCreateResponse {
  code: "ok" | "error";
  msg?: string;
  error?: string;
  order_id?: number | string;
  is_double?: boolean;
}

export interface AdcomboStatusItem {
  order_id: number | string;
  status: string; // hold | confirmed | cancelled | trash | unknown
  price?: string | number; // revenue del confirmed en currency_code pedido
  currency_code?: string;
  extra_state?: string;
  comment?: string;
}

export interface AdcomboStatusResponse {
  code: string;
  data?: AdcomboStatusItem[];
}

export interface AdcomboPayout {
  amount?: number;
  currency?: string;
  country_code?: string | null;
}

export interface AdcomboTotalPrice {
  default?: Array<{ price?: number; price_raw?: number; currency?: string }>;
}

export interface AdcomboOfferItem {
  id: number;
  name: string;
  countries?: string;
  type?: string;
  state?: string;
  payout?: AdcomboPayout[];
  total_price?: AdcomboTotalPrice;
}

export interface AdcomboOfferInfoResponse {
  offers?: AdcomboOfferItem[];
  total?: number;
  page?: number;
  per_page?: number;
}
