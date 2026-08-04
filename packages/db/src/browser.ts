import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "./types";

/**
 * Supabase client for Client Components. NEXT_PUBLIC_ vars must be referenced
 * literally so Next.js can inline them into the browser bundle.
 */
export function createBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set. " +
        "Add them to apps/admin/.env.local (see .env.example)."
    );
  }
  return createBrowserClient<Database>(url, key);
}
