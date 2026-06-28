import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/cron-auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

const log = logger.child({ route: "POST /api/admin/leads/delete" });

/**
 * Borra leads (y su historial, por cascade) por `ids` o `externalIds`.
 * Herramienta de ops para limpiar leads basura/de prueba. Bearer CRON_SECRET.
 * Body JSON: { ids?: string[], externalIds?: string[] }
 */
export async function POST(req: Request): Promise<Response> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { ids?: string[]; externalIds?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const ids = Array.isArray(body.ids) ? body.ids : [];
  const externalIds = Array.isArray(body.externalIds) ? body.externalIds : [];
  if (ids.length === 0 && externalIds.length === 0) {
    return NextResponse.json(
      { error: "se requiere ids[] o externalIds[]" },
      { status: 400 },
    );
  }

  const result = await prisma.lead.deleteMany({
    where: {
      OR: [
        ...(ids.length ? [{ id: { in: ids } }] : []),
        ...(externalIds.length ? [{ externalId: { in: externalIds } }] : []),
      ],
    },
  });

  log.info({ deleted: result.count, ids, externalIds }, "leads borrados");
  return NextResponse.json({ status: "ok", deleted: result.count });
}
