import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { isSecretSettingKey, SETTING_KEYS, type SettingKey } from "@aiwebsite/config";

import { decryptSecret, encryptSecret } from "../crypto";
import type { Database, Json } from "../types";

type DB = SupabaseClient<Database>;

// ── Agency profile ────────────────────────────────────────────────

export interface AgencyProfile {
  name: string;
  logo_url: string;
  whatsapp: string;
  email: string;
  address: string;
  gst_no: string;
}

export const EMPTY_AGENCY_PROFILE: AgencyProfile = {
  name: "",
  logo_url: "",
  whatsapp: "",
  email: "",
  address: "",
  gst_no: "",
};

export async function getAgencyProfile(db: DB): Promise<AgencyProfile> {
  const { data, error } = await db
    .from("aiwebsite_settings")
    .select("value")
    .eq("key", SETTING_KEYS.agencyProfile)
    .maybeSingle();
  if (error) throw new Error(`Failed to load agency profile: ${error.message}`);

  const stored = (data?.value ?? {}) as Partial<AgencyProfile>;
  return { ...EMPTY_AGENCY_PROFILE, ...stored };
}

export async function saveAgencyProfile(
  db: DB,
  profile: AgencyProfile,
  userId: string
): Promise<void> {
  const { error } = await db.from("aiwebsite_settings").upsert({
    key: SETTING_KEYS.agencyProfile,
    value: profile as unknown as Json,
    is_secret: false,
    updated_by: userId,
  });
  if (error) throw new Error(`Failed to save agency profile: ${error.message}`);
}

// ── Generic JSON settings (non-secret) ───────────────────────────

export async function getJsonSetting(db: DB, key: SettingKey): Promise<Json | null> {
  const { data, error } = await db
    .from("aiwebsite_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) throw new Error(`Failed to load setting "${key}": ${error.message}`);
  return data?.value ?? null;
}

export async function saveJsonSetting(
  db: DB,
  key: SettingKey,
  value: Json,
  userId: string
): Promise<void> {
  const { error } = await db.from("aiwebsite_settings").upsert({
    key,
    value,
    is_secret: false,
    updated_by: userId,
  });
  if (error) throw new Error(`Failed to save setting "${key}": ${error.message}`);
}

// ── Integration settings (API keys etc.) ─────────────────────────

/** Shape stored in `value` for secret settings. Ciphertext never leaves the server. */
interface SecretValue {
  encrypted: string;
  last4: string;
}

/** Shape stored in `value` for plain settings. */
interface PlainValue {
  value: string;
}

export interface SettingStatus {
  isSet: boolean;
  /** Last 4 characters, for masked display of secrets. */
  last4: string | null;
  /** Full value — only present for non-secret settings. */
  plainValue: string | null;
}

export async function getSettingsStatus(
  db: DB,
  keys: readonly SettingKey[]
): Promise<Record<string, SettingStatus>> {
  const { data, error } = await db
    .from("aiwebsite_settings")
    .select("key, value, is_secret")
    .in("key", [...keys]);
  if (error) throw new Error(`Failed to load settings: ${error.message}`);

  const result: Record<string, SettingStatus> = {};
  for (const key of keys) {
    result[key] = { isSet: false, last4: null, plainValue: null };
  }
  for (const row of data ?? []) {
    if (row.is_secret) {
      const value = row.value as unknown as SecretValue;
      result[row.key] = { isSet: !!value.encrypted, last4: value.last4 ?? null, plainValue: null };
    } else {
      const value = row.value as unknown as PlainValue;
      result[row.key] = {
        isSet: (value.value ?? "") !== "",
        last4: null,
        plainValue: value.value ?? "",
      };
    }
  }
  return result;
}

export async function saveSettingValue(
  db: DB,
  key: SettingKey,
  plaintext: string,
  userId: string
): Promise<void> {
  const isSecret = isSecretSettingKey(key);
  const value: Json = isSecret
    ? ({ encrypted: encryptSecret(plaintext), last4: plaintext.slice(-4) } as unknown as Json)
    : ({ value: plaintext } as unknown as Json);

  const { error } = await db.from("aiwebsite_settings").upsert({
    key,
    value,
    is_secret: isSecret,
    updated_by: userId,
  });
  if (error) throw new Error(`Failed to save setting "${key}": ${error.message}`);
}

export async function clearSetting(db: DB, key: SettingKey): Promise<void> {
  const { error } = await db.from("aiwebsite_settings").delete().eq("key", key);
  if (error) throw new Error(`Failed to clear setting "${key}": ${error.message}`);
}

/**
 * Decrypted value for server-side use (AI calls, webhooks). Pass an admin
 * client from cron/webhook contexts; user-context clients work too since
 * authenticated users may read settings rows.
 */
export async function getDecryptedSetting(db: DB, key: SettingKey): Promise<string | null> {
  const { data, error } = await db
    .from("aiwebsite_settings")
    .select("value, is_secret")
    .eq("key", key)
    .maybeSingle();
  if (error) throw new Error(`Failed to read setting "${key}": ${error.message}`);
  if (!data) return null;

  if (data.is_secret) {
    const value = data.value as unknown as SecretValue;
    return value.encrypted ? decryptSecret(value.encrypted) : null;
  }
  const value = data.value as unknown as PlainValue;
  return value.value ?? null;
}
