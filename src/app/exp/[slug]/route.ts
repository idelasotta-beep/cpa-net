import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Elección ponderada por peso. */
function pickWeighted<T extends { weight: number }>(variants: T[]): T {
  const total = variants.reduce((s, v) => s + Math.max(1, v.weight), 0);
  let r = Math.random() * total;
  for (const v of variants) {
    r -= Math.max(1, v.weight);
    if (r < 0) return v;
  }
  return variants[variants.length - 1]!;
}

/** Redirige a la variante destino, arrastrando los query params entrantes (utm/fbclid). */
function buildTarget(url: string, incoming: URLSearchParams): string {
  try {
    const dest = new URL(url);
    incoming.forEach((val, key) => {
      if (!dest.searchParams.has(key)) dest.searchParams.set(key, val);
    });
    return dest.toString();
  } catch {
    return url;
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  const exp = await prisma.experiment.findFirst({
    where: { slug, active: true },
    include: { variants: true },
  });
  if (!exp || exp.variants.length === 0) {
    return NextResponse.json({ error: "experiment_not_found" }, { status: 404 });
  }

  const incoming = new URL(req.url).searchParams;
  const cookieName = `exp_${slug}`;

  // Sticky: si el visitante ya tiene variante asignada y sigue existiendo, la reusamos.
  const cookieVal = req.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);

  const variant = exp.variants.find((v) => v.id === cookieVal) ?? pickWeighted(exp.variants);

  const res = NextResponse.redirect(buildTarget(variant.url, incoming), 302);
  res.cookies.set(cookieName, variant.id, {
    maxAge: 60 * 60 * 24 * 30, // 30 días
    path: "/",
    sameSite: "lax",
    httpOnly: true,
  });
  // No cachear el redirect (el reparto debe ser por request).
  res.headers.set("Cache-Control", "no-store");
  return res;
}
