import { createClient } from "@supabase/supabase-js";

/**
 * Standalone service-role client for E2E setup only — deliberately does not
 * import @aiwebsite/db (its "server-only" guard would throw outside a
 * Next.js server context, and Playwright's config/tests run in plain Node).
 */
function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`E2E setup: missing env var ${name} (see e2e/README.md)`);
  return value;
}

export function createE2eAdminClient() {
  return createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Generates a real 6-digit email OTP for `email` via the Supabase Admin API
 * — the same code that would otherwise be emailed to the user — so the
 * test can drive the actual login UI (request code → enter code) rather
 * than bypassing auth.
 */
export async function generateTestOtp(email: string): Promise<string> {
  const admin = createE2eAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error || !data.properties?.email_otp) {
    throw new Error(`Could not generate a test OTP for ${email}: ${error?.message ?? "no email_otp in response"}`);
  }
  return data.properties.email_otp;
}
