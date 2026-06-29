import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/cron-auth";
import { runPollStatus } from "@/lib/jobs/poll-status";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

const log = logger.child({ route: "GET /api/jobs/poll-status" });

export async function GET(req: Request): Promise<Response> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await runPollStatus();
    return NextResponse.json(result);
  } catch (err) {
    log.error(
      { err: err instanceof Error ? { message: err.message, stack: err.stack } : err },
      "poll-status falló",
    );
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
