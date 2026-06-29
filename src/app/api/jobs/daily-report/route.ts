import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/cron-auth";
import { prisma } from "@/lib/db";
import {
  periodRange,
  santiagoDayKey,
  santiagoHour,
  yesterdayKey,
} from "@/lib/dashboard/dates";
import { formatPct, formatUsd } from "@/lib/dashboard/metrics";
import { getAppSettings, getSummary } from "@/lib/dashboard/queries";
import { logger } from "@/lib/logger";
import { sendAlert } from "@/lib/notify";

export const runtime = "nodejs";

const log = logger.child({ route: "GET /api/jobs/daily-report" });

export async function GET(req: Request): Promise<Response> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const settings = await getAppSettings();
    if (!settings.dailyReportEnabled) {
      return NextResponse.json({ skipped: "disabled" });
    }

    const now = new Date();
    if (santiagoHour(now) !== settings.dailyReportHour) {
      return NextResponse.json({ skipped: "not the hour" });
    }

    const today = santiagoDayKey(now);
    if (settings.lastDailyReportDate === today) {
      return NextResponse.json({ skipped: "already sent today" });
    }

    const ymd = yesterdayKey(now);
    const { from, to } = periodRange("custom", ymd, ymd, now);
    const s = await getSummary(from, to);
    const c = s.counts;

    const subject = `📊 Reporte diario — ${ymd}`;
    const body = [
      `Leads nuevos: ${s.total}`,
      `🟢 Aprobados: ${c.lead} · 🔴 Rechazados: ${c.reject} · 🟡 Hold: ${c.hold} · 🗑 Trash: ${c.trash}`,
      `Pendientes: ${c.pending} · Enviados: ${c.sent_to_network} · Fallidos: ${c.failed}`,
      "",
      `Approval: ${formatPct(s.approval)} (quality ${formatPct(s.quality)})`,
      `💵 Revenue: ${formatUsd(s.revenue)} · Costo: ${formatUsd(s.cost)}`,
      `📈 Profit: ${formatUsd(s.profit)} · ROI: ${s.cost === 0 ? "—" : formatPct(s.roi)}`,
    ].join("\n");

    await sendAlert(subject, body);

    await prisma.appSettings.update({
      where: { id: "singleton" },
      data: { lastDailyReportDate: today },
    });

    log.info({ ymd, total: s.total }, "reporte diario enviado");
    return NextResponse.json({ sent: true, date: ymd });
  } catch (err) {
    log.error(
      { err: err instanceof Error ? { message: err.message, stack: err.stack } : err },
      "daily-report falló",
    );
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
