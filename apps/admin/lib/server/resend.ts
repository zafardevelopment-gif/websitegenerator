import "server-only";

import { Resend } from "resend";

import { SETTING_KEYS } from "@aiwebsite/config";
import { createAdminSupabase } from "@aiwebsite/db/admin";
import { getDecryptedSetting } from "@aiwebsite/db/settings";

export async function getResendClient(): Promise<Resend | null> {
  const db = createAdminSupabase();
  const apiKey =
    process.env.RESEND_API_KEY?.trim() ||
    (await getDecryptedSetting(db, SETTING_KEYS.resendApiKey).catch(() => null));
  if (!apiKey) return null;
  return new Resend(apiKey);
}
