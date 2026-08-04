import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@aiwebsite/db/middleware";

// TEMP: auth check disabled for testing. Re-enable before shipping —
// just restore the `return updateSession(...)` line below.
const AUTH_DISABLED = true;

export async function middleware(request: NextRequest) {
  if (AUTH_DISABLED) {
    return NextResponse.next();
  }
  return updateSession(request, { loginPath: "/login" });
}

export const config = {
  matcher: [
    // Everything except static assets and images.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
