/**
 * Respuesta del `POST /api/external/orders` de Latinecom.
 *
 * GOTCHA: la API responde HTTP 200 incluso cuando el lead va a papelera
 * (duplicado del día, validación fallida). El éxito real trae `orderId`/`leadNumber`;
 * la basura llega con distintas marcas (autoTrash, status="trash", message con
 * "DUPLICATE"/"Validation failed"/"MISSING_NOTE_ATTRIBUTE", validationErrors, etc.).
 * Por eso el tipo es permisivo: sondeamos varios campos posibles.
 */
export interface EcomlatamCreateResponse {
  orderId?: string | number;
  leadNumber?: string | number;
  id?: string | number;
  status?: string;
  message?: string;
  error?: string;
  warning?: string;
  autoTrash?: boolean;
  autoTrashed?: boolean;
  isTrash?: boolean;
  isTrashed?: boolean;
  trashed?: boolean;
  trashReason?: string;
  validationErrors?: unknown;
  errors?: unknown;
  lead?: { id?: string | number; status?: string; trashReason?: string };
  data?: { status?: string };
  [key: string]: unknown;
}
