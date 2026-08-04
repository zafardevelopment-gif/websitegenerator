import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

import { requireEnv, supabaseAnonKey, supabaseUrl } from "./env";
import type { Database } from "./types";

// TEMP: testing-only bypass (mirrors AUTH_DISABLED in apps/admin/middleware.ts
// and app/(app)/layout.tsx). When there's no real session, fall back to a
// service-role client impersonating a fixed local test user so RLS-gated
// server actions still work. Re-enable real auth before shipping by deleting
// this whole block along with the two AUTH_DISABLED flags.
const AUTH_DISABLED = true;
const TEST_USER_ID = "d9421150-d2a9-4e6e-b5b5-1a67560349c8";
const TEST_USER_EMAIL = "test-local@aivexa.local";

/**
 * Supabase client for Server Components, Server Actions, and Route Handlers.
 * Runs with the signed-in user's session — RLS applies.
 */
export async function createServerSupabase() {
  const cookieStore = await cookies();

  const client = createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component — session refresh is handled by middleware.
        }
      },
    },
  });

  if (!AUTH_DISABLED) return client;

  const {
    data: { user },
  } = await client.auth.getUser();
  if (user) return client;

  // No real session — return a service-role client (bypasses RLS) with
  // getUser() patched to report the fixed test user, so requireUser() calls
  // in server actions succeed.
  const admin = createClient<Database>(supabaseUrl(), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const fakeUser = {
    id: TEST_USER_ID,
    email: TEST_USER_EMAIL,
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  };
  admin.auth.getUser = (async () => ({
    data: { user: fakeUser },
    error: null,
  })) as typeof admin.auth.getUser;
  return admin;
}
