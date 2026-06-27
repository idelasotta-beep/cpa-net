import { type NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

// Endpoints con su propia autenticación (no requieren sesión de dashboard).
const SELF_AUTH_API = [
  "/api/leads/",
  "/api/jobs/",
  "/api/admin/",
  "/api/postback/",
];

export async function proxy(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  if (pathname === "/login") return NextResponse.next();
  if (SELF_AUTH_API.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Todo salvo assets estáticos y archivos con extensión.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
