import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

// Reachable without signing in. /setup guards itself (only works on an empty DB).
const PUBLIC_PATHS = ["/login", "/setup", "/api/logo"];

// Optimistic check only — real authorization happens in requireUser().
// (Logged-in users on /login are redirected by the page itself, after checking the
// user still exists — doing it here could loop for a deactivated account.)
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  const isPublic = PUBLIC_PATHS.includes(pathname);

  if (!session && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico|webp)$).*)"],
};
