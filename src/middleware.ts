import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "mzl_session";
const PROTECTED = ["/explorar", "/mapa"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    if (!req.cookies.get(SESSION_COOKIE)?.value) {
      const url = req.nextUrl.clone();
      url.pathname = "/demo";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = { matcher: ["/explorar/:path*", "/mapa/:path*"] };
