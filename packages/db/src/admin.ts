import "server-only";

import { createClient } from "@supabase/supabase-js";

import { requireEnv, supabaseUrl } from "./env";
import type { Database } from "./types";

/**
 * Service-role client. BYPASSES RLS — use only for trusted server-side
 * operations that cannot run in user context (auth bootstrap checks,
 * cron jobs, webhook handlers, secret decryption for outbound API calls).
 */
export function createAdminSupabase() {
  return createClient<Database>(supabaseUrl(), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
