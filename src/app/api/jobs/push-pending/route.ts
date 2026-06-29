import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/cron-auth";
import { runPushPending } from "@/lib/jobs/push-pending";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

const log = logger.child({ route: "GET /api/jobs/push-pending" });

export async function GET(req: Request): Promise<Response> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await runPushPending();
    return NextResponse.json(result);
  } catch (err) {
    log.error(
      { err: err instanceof Error ? { message: err.message, stack: err.stack } : err },
      "push-pending falló",
    );
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
