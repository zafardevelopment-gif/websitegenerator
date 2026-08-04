import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { supabaseAnonKey, supabaseUrl } from "./env";
import type { Database } from "./types";

export interface UpdateSessionOptions {
  /** Path of the login page. Signed-out users are redirected here. */
  loginPath?: string;
  /** Additional path prefixes reachable without a session. */
  publicPaths?: string[];
}

/**
 * Next.js middleware helper: refreshes the Supabase session cookie and
 * enforces authentication for all non-public paths.
 */
export async function updateSession(
  request: NextRequest,
  { loginPath = "/login", publicPaths = [] }: UpdateSessionOptions = {}
): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // IMPORTANT: do not run code between client creation and getUser() —
  // it can cause session refresh races (see Supabase SSR docs).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isLogin = path === loginPath || path.startsWith(`${loginPath}/`);
  const isPublic = isLogin || publicPaths.some((p) => path === p || path.startsWith(`${p}/`));

  const redirectTo = (pathname: string) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = "";
    const redirect = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  if (!user && !isPublic) {
    return redirectTo(loginPath);
  }
  if (user && isLogin) {
    return redirectTo("/");
  }

  return supabaseResponse;
}
