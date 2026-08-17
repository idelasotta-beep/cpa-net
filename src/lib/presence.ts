/**
 * Presencia en vivo de visitantes de las landings ("N ahora").
 *
 * Store en memoria (efímero por naturaleza): cada landing manda un heartbeat cada
 * ~20s mientras la pestaña está visible; contamos los vistos en los últimos 60s.
 * Vive en el proceso del server (Railway = 1 instancia con `next start`) → se comparte
 * entre requests y se resetea en cada deploy (aceptable: la presencia es efímera).
 * Sin DB → no genera carga de escritura por los heartbeats.
 */

const WINDOW_MS = 60_000;
const MAX_ENTRIES = 50_000;

interface Entry {
  landingId: string;
  last: number;
}

const store = new Map<string, Entry>(); // key = visitorId

function prune(): void {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [k, v] of store) {
    if (v.last < cutoff) store.delete(k);
  }
}

/** Registra actividad de un visitante en una landing. */
export function heartbeat(vid: string, landingId: string): void {
  if (!vid) return;
  store.set(vid.slice(0, 100), { landingId: (landingId || "").slice(0, 100), last: Date.now() });
  if (store.size > MAX_ENTRIES) prune();
}

/** Conteo de visitantes activos (últimos 60s): total y por landing. */
export function snapshot(): { total: number; byLanding: Record<string, number> } {
  const cutoff = Date.now() - WINDOW_MS;
  const byLanding: Record<string, number> = {};
  let total = 0;
  for (const v of store.values()) {
    if (v.last < cutoff) continue;
    total++;
    const id = v.landingId || "(sin landing)";
    byLanding[id] = (byLanding[id] || 0) + 1;
  }
  return { total, byLanding };
}
