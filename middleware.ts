import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // On Vercel (production), only allow /replay routes
  if (process.env.VERCEL && !request.nextUrl.pathname.startsWith("/replay")) {
    return NextResponse.rewrite(new URL("/replay", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Skip static assets and Next.js internals
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
