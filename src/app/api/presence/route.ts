import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/server";
import { corsHeaders } from "@/lib/http/landing-cors";
import { heartbeat, snapshot } from "@/lib/presence";

export const runtime = "nodejs";

export function OPTIONS(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

/** Heartbeat público desde la landing (visitante activo). Sin PII, sin DB. */
export async function POST(req: Request): Promise<Response> {
  const headers = corsHeaders(req);
  try {
    const body = JSON.parse(await req.text()) as { landingId?: unknown; vid?: unknown };
    const vid = typeof body.vid === "string" ? body.vid : "";
    const landingId = typeof body.landingId === "string" ? body.landingId : "";
    if (vid) heartbeat(vid, landingId);
  } catch {
    /* beacon malformado: se ignora */
  }
  return new Response(null, { status: 204, headers });
}

/** Conteo de visitantes activos (para el dashboard). Requiere sesión. */
export async function GET(): Promise<Response> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(snapshot(), {
    headers: { "Cache-Control": "no-store" },
  });
}
