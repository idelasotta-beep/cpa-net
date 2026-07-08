/** Respuestas de la API de Latinleads (IGALFER). Los flags vienen como "0"/"1". */

// La API es inconsistente: algunos flags vienen como número (1) y otros como string ("0").
type Flag = string | number;

export interface LatinleadsCreateResponse {
  order_id?: string;
  status?: string; // "ok" | "error"
  ext_id?: string | null; // id en Latinleads
  error?: string;
  is_wrongtelephone?: Flag;
  is_duplicate?: Flag;
  is_blacklist?: Flag;
  is_valid?: Flag;
}

export interface LatinleadsStatusItem {
  order_id: string | number; // = ext_id
  status: string; // confirm | hold | cancelled | trash | Dont Exist
}
