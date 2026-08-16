import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/cron-auth";
import { runAbandonedCartWebhook } from "@/lib/jobs/abandoned-carts";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

const log = logger.child({ route: "GET /api/jobs/abandoned-carts" });

/** Dispara el webhook de carritos abandonados. Agendar en el scheduler (Bearer CRON_SECRET). */
export async function GET(req: Request): Promise<Response> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await runAbandonedCartWebhook();
    return NextResponse.json(result);
  } catch (err) {
    log.error(
      { err: err instanceof Error ? { message: err.message, stack: err.stack } : err },
      "abandoned-carts falló",
    );
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
