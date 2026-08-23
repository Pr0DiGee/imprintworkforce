import { NextRequest, NextResponse } from "next/server";

// Routes that do NOT require authentication
const PUBLIC_ROUTES = ["/login", "/checkin", "/check-in", "/api"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Allow static files and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/" ||
    pathname === "/logo.png"
  ) {
    return NextResponse.next();
  }

  // Check for session cookie on all other routes (dashboard/*)
  const session = request.cookies.get("session");

  if (!session?.value) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all routes except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - logo.png
     */
    "/((?!_next/static|_next/image|favicon.ico|logo.png).*)",
  ],
};
