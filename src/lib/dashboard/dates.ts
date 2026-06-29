/**
 * Manejo de fechas/timezone para el dashboard.
 * Todo se persiste en UTC; acá calculamos rangos y partes según America/Santiago.
 */

const TZ = "America/Santiago";

export type Period = "today" | "7d" | "30d" | "custom";

function partsInTz(date: Date): Record<string, string> {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const map: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) map[p.type] = p.value;
  return map;
}

/** Offset (hora local Santiago − UTC) en ms para ese instante (maneja DST). */
function tzOffsetMs(date: Date): number {
  const m = partsInTz(date);
  const asUTC = Date.UTC(
    +m.year!,
    +m.month! - 1,
    +m.day!,
    +m.hour! % 24,
    +m.minute!,
    +m.second!,
  );
  return asUTC - date.getTime();
}

/** Instante UTC correspondiente a las 00:00 (hora Santiago) de un Y-M-D. */
function santiagoDayStartUtc(y: number, mo: number, d: number): Date {
  const noonGuess = Date.UTC(y, mo - 1, d, 12, 0, 0);
  const off = tzOffsetMs(new Date(noonGuess));
  return new Date(Date.UTC(y, mo - 1, d, 0, 0, 0) - off);
}

export function santiagoToday(now = new Date()): { y: number; mo: number; d: number } {
  const m = partsInTz(now);
  return { y: +m.year!, mo: +m.month!, d: +m.day! };
}

export function periodRange(
  period: Period,
  customFrom?: string,
  customTo?: string,
  now = new Date(),
): { from: Date; to: Date } {
  if (period === "custom" && customFrom && customTo) {
    const [fy, fm, fd] = customFrom.split("-").map(Number);
    const [ty, tm, td] = customTo.split("-").map(Number);
    const from = santiagoDayStartUtc(fy!, fm!, fd!);
    const toStart = santiagoDayStartUtc(ty!, tm!, td!);
    return { from, to: new Date(toStart.getTime() + 24 * 3600 * 1000) };
  }

  const { y, mo, d } = santiagoToday(now);
  const todayStart = santiagoDayStartUtc(y, mo, d);
  if (period === "today") return { from: todayStart, to: now };

  const days = period === "30d" ? 29 : 6;
  const base = new Date(Date.UTC(y, mo - 1, d));
  base.setUTCDate(base.getUTCDate() - days);
  const from = santiagoDayStartUtc(
    base.getUTCFullYear(),
    base.getUTCMonth() + 1,
    base.getUTCDate(),
  );
  return { from, to: now };
}

/** Clave de día local "YYYY-MM-DD" (para agrupar por día). */
export function santiagoDayKey(date: Date): string {
  const m = partsInTz(date);
  return `${m.year}-${m.month}-${m.day}`;
}

/** Hora local 0-23. */
export function santiagoHour(date: Date): number {
  return +partsInTz(date).hour! % 24;
}

/** Día de la semana local 0-6 (0 = domingo). */
export function santiagoWeekday(date: Date): number {
  const m = partsInTz(date);
  return new Date(Date.UTC(+m.year!, +m.month! - 1, +m.day!)).getUTCDay();
}

/** Clave "YYYY-MM-DD" (Santiago) del día anterior. */
export function yesterdayKey(now = new Date()): string {
  const { y, mo, d } = santiagoToday(now);
  const base = new Date(Date.UTC(y, mo - 1, d));
  base.setUTCDate(base.getUTCDate() - 1);
  const yy = base.getUTCFullYear();
  const mm = String(base.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(base.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Formato legible para la UI (es-CL). */
export function formatSantiago(date: Date): string {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: TZ,
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}
