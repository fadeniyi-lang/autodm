import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const PROTECTED_PREFIXES = ["/dashboard", "/automations", "/logs", "/settings"];

// A session cookie merely being present doesn't mean it's still valid — a
// secret rotation, an expired token, or any other reason the real session
// check (lib/auth.ts's `auth()`) rejects it and this cookie-presence check
// still says "yes" is an infinite redirect loop: /dashboard bounces to
// /login for real, /login bounces straight back to /dashboard because the
// stale cookie is still sitting in the browser, forever
// (ERR_TOO_MANY_REDIRECTS). Actually verifying the JWT here — same secret,
// same library, no DB round trip needed — means a bad cookie is treated as
// "not authenticated" instead of "authenticated", which breaks the loop and
// sends them to a working login page instead.
async function isAuthenticated(request: NextRequest): Promise<boolean> {
  // getToken() defaults secureCookie to false when it's not passed explicitly,
  // which makes it read the plain "authjs.session-token" cookie (and derive
  // its decryption salt from that name) instead of the "__Secure-" prefixed
  // one auth() actually issues in production — so this always came back
  // null here, bouncing every real, valid session back to /login with no
  // error shown. Match the same production-secure-cookie rule NextAuth
  // itself uses when issuing the cookie.
  const secureCookie = process.env.NODE_ENV === "production";
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET, secureCookie });
  return Boolean(token);
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  const isLogin = pathname === "/login";

  if (!isProtected && !isLogin) {
    return NextResponse.next();
  }

  const authenticated = await isAuthenticated(request);

  if (isProtected && !authenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLogin && authenticated) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/automations/:path*",
    "/logs/:path*",
    "/settings/:path*",
    "/login",
  ],
};
