import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/cron-auth";
import { getLandingConversion } from "@/lib/dashboard/landing-conversion";

export const runtime = "nodejs";

/** Parsea yyyy-mm-dd a medianoche UTC, o null si no es válido. */
function parseDay(v: string | null): Date | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Analítica de conversión de las landings propias (JSON). Embudo:
 * visita → form abierto → lead → aprobado. Protegido con Bearer CRON_SECRET.
 * Query: ?days=14 | ?from=YYYY-MM-DD&to=YYYY-MM-DD | ?landingId=... | ?series=1
 */
export async function GET(req: Request): Promise<Response> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sp = new URL(req.url).searchParams;
  const landingId = sp.get("landingId")?.trim() || null;
  const withSeries = sp.get("series") === "1" || sp.get("series") === "true";

  const days = Math.min(365, Math.max(1, Number(sp.get("days")) || 14));
  const fromParam = parseDay(sp.get("from"));
  const toParam = parseDay(sp.get("to"));
  const todayMidnight = new Date();
  todayMidnight.setUTCHours(0, 0, 0, 0);

  const from = fromParam ?? new Date(todayMidnight.getTime() - (days - 1) * 86_400_000);
  const to = toParam ? new Date(toParam.getTime() + 86_400_000) : new Date(todayMidnight.getTime() + 86_400_000);

  const data = await getLandingConversion({ from, to, landingId, withSeries });

  return NextResponse.json({
    from: from.toISOString().slice(0, 10),
    to: new Date(to.getTime() - 86_400_000).toISOString().slice(0, 10),
    landingId,
    totals: data.totals,
    landings: data.landings,
    ...(withSeries ? { series: data.series } : {}),
  });
}
