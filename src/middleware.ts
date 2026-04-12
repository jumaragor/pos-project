import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { authDebug } from "@/lib/auth-debug";

const cashierAllowed = ["/pos", "/customers"];
const protectedPrefixes = [
  "/dashboard",
  "/pos",
  "/inventory",
  "/purchases",
  "/expenses",
  "/suppliers",
  "/customers",
  "/reports",
  "/configuration",
  "/users",
  "/settings"
];

function normalizeCallbackPath(raw: string | null, fallback = "/dashboard") {
  if (!raw) return fallback;
  if (raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/login")) {
    return raw;
  }
  return fallback;
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isProtected = protectedPrefixes.some((prefix) => pathname.startsWith(prefix));
  const isLogin = pathname === "/login";

  if (!isProtected && !isLogin) {
    return NextResponse.next();
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  authDebug("middleware.check", {
    pathname,
    isProtected,
    isLogin,
    hasToken: Boolean(token),
    role: token?.role ?? null
  });

  if (isLogin) {
    if (token) {
      const callbackUrl = normalizeCallbackPath(request.nextUrl.searchParams.get("callbackUrl"));
      authDebug("middleware.redirect-authenticated-login", { pathname, callbackUrl });
      return NextResponse.redirect(new URL(callbackUrl, request.url));
    }
    return NextResponse.next();
  }

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
    authDebug("middleware.redirect-unauthenticated", {
      pathname,
      callbackUrl: `${pathname}${search}`
    });
    return NextResponse.redirect(loginUrl);
  }

  if (token.role === "CASHIER") {
    const allowed = cashierAllowed.some((prefix) => pathname.startsWith(prefix));
    if (!allowed) {
      authDebug("middleware.redirect-cashier", { pathname, target: "/pos" });
      return NextResponse.redirect(new URL("/pos", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json).*)"]
};
