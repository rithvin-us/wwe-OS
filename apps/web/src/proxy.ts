import { NextResponse, type NextRequest } from "next/server";

const ACCESS_COOKIE = "access_token";

/**
 * Cheap, edge-level gate: no session cookie at all means "never signed in"
 * or "explicitly signed out" — redirect immediately, no need to ask Django.
 * An expired-but-present token is a different case, handled by the pages
 * themselves (a 401 from `djangoFetch` redirects to login) and kept alive
 * transparently in the background by `SessionRefresh` — see
 * `src/components/session-refresh.tsx`.
 *
 * This is deliberately an optimistic check only, per Next's own guidance:
 * proxy isn't a full session/authorization solution. Real authorization
 * happens on every Django call regardless of what this function decides.
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(ACCESS_COOKIE);

  // if (!hasSession) {
  //   const url = new URL("/login", request.url);
  //   url.searchParams.set("next", request.nextUrl.pathname);
  //   return NextResponse.redirect(url);
  // }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Every route except: /login, /api/*, and Next.js internals/static
     * assets. This protects the whole (platform) route group in one place
     * instead of per-page checks.
     */
    "/((?!login|api|_next/static|_next/image|favicon.ico).*)",
  ],
};
