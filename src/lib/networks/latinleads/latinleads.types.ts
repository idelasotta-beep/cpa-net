/** Respuestas de la API de Latinleads (IGALFER). Los flags vienen como "0"/"1". */

export interface LatinleadsCreateResponse {
  order_id?: string;
  status?: string; // "ok" | "error"
  ext_id?: string | null; // id en Latinleads
  error?: string;
  is_wrongtelephone?: string;
  is_duplicate?: string;
  is_blacklist?: string;
  is_valid?: string;
}

export interface LatinleadsStatusItem {
  order_id: string | number; // = ext_id
  status: string; // confirm | hold | cancelled | trash | Dont Exist
}
