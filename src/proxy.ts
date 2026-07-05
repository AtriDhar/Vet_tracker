// Next.js 16 proxy (formerly middleware): optimistic auth guard.
// Full session validation happens in route handlers via getSessionUser().

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "vettracker-dev-secret-change-in-production"
);
const COOKIE_NAME = "vt_session";

const PROTECTED = ["/dashboard", "/pets", "/vets", "/appointments", "/vet-portal"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(COOKIE_NAME)?.value;
  let authed = false;
  if (token) {
    try {
      await jwtVerify(token, SECRET);
      authed = true;
    } catch {
      authed = false;
    }
  }

  if (PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/")) && !authed) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if ((pathname === "/login" || pathname === "/signup") && authed) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/pets/:path*",
    "/vets/:path*",
    "/appointments/:path*",
    "/vet-portal/:path*",
    "/login",
    "/signup",
  ],
};
