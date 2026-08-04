"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { SETTING_KEYS, type SettingKey } from "@aiwebsite/config";
import { createServerSupabase } from "@aiwebsite/db/server";
import {
  clearSetting,
  saveAgencyProfile,
  saveSettingValue,
} from "@aiwebsite/db/settings";

import { agencyProfileSchema, apiKeysSchema } from "../validation/settings";

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

function friendlyError(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e);
  if (/row-level security/i.test(message)) {
    return "Only the owner can modify settings.";
  }
  return message;
}

async function requireUser() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  return { supabase, user };
}

export async function saveAgencyProfileAction(input: unknown): Promise<ActionResult> {
  const parsed = agencyProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const { supabase, user } = await requireUser();
    await saveAgencyProfile(supabase, parsed.data, user.id);
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }

  revalidatePath("/settings");
  revalidatePath("/");
  return { ok: true, message: "Agency profile saved." };
}

export async function saveApiKeysAction(input: unknown): Promise<ActionResult> {
  const parsed = apiKeysSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const entries = Object.entries(parsed.data).filter(([, value]) => value !== "") as [
    SettingKey,
    string,
  ][];
  if (entries.length === 0) {
    return { ok: false, error: "Nothing to save — all fields are empty." };
  }

  try {
    const { supabase, user } = await requireUser();
    for (const [key, value] of entries) {
      await saveSettingValue(supabase, key, value, user.id);
    }
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }

  revalidatePath("/settings/api-keys");
  revalidatePath("/");
  return {
    ok: true,
    message: `Saved ${entries.length} ${entries.length === 1 ? "value" : "values"}.`,
  };
}

const settingKeySchema = z.enum(
  Object.values(SETTING_KEYS) as [SettingKey, ...SettingKey[]]
);

export async function clearSettingAction(key: unknown): Promise<ActionResult> {
  const parsed = settingKeySchema.safeParse(key);
  if (!parsed.success) {
    return { ok: false, error: "Unknown setting." };
  }

  try {
    const { supabase } = await requireUser();
    await clearSetting(supabase, parsed.data);
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }

  revalidatePath("/settings/api-keys");
  revalidatePath("/");
  return { ok: true, message: "Setting cleared." };
}
