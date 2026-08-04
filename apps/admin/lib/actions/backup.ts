"use server";

import { createServerSupabase } from "@aiwebsite/db/server";
import { getUserProfile } from "@aiwebsite/db/users";
import type { Json } from "@aiwebsite/db/types";

export type BackupResult =
  | { ok: true; message: string; data: { json: string; fileName: string } }
  | { ok: false; error: string };

/**
 * Every application table, in FK-safe order (parents before children) so a
 * restore script can re-insert rows without violating foreign keys.
 */
const BACKUP_TABLES = [
  "aiwebsite_users",
  "aiwebsite_settings",
  "aiwebsite_templates",
  "aiwebsite_leads",
  "aiwebsite_lead_activities",
  "aiwebsite_lead_imports",
  "aiwebsite_sites",
  "aiwebsite_site_versions",
  "aiwebsite_site_sections",
  "aiwebsite_deployments",
  "aiwebsite_media_assets",
  "aiwebsite_site_visits",
  "aiwebsite_site_events",
  "aiwebsite_form_submissions",
  "aiwebsite_message_templates",
  "aiwebsite_messages",
  "aiwebsite_follow_ups",
  "aiwebsite_quotations",
  "aiwebsite_quotation_items",
  "aiwebsite_payments",
  "aiwebsite_clients",
  "aiwebsite_domains",
  "aiwebsite_prompt_templates",
  "aiwebsite_ai_usage_logs",
  "aiwebsite_audit_logs",
  "aiwebsite_notifications",
  "aiwebsite_health_scores",
] as const;

async function requireOwner() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  const profile = await getUserProfile(supabase, user.id);
  if (profile?.role !== "owner") {
    throw new Error("Only the owner can export a full data backup.");
  }
  return supabase;
}

/**
 * Full-database JSON export for backup/disaster-recovery. Secret setting
 * VALUES are redacted (key/metadata kept) — re-enter API keys manually
 * after a restore rather than round-tripping plaintext secrets through a
 * downloadable file.
 */
export async function exportFullBackupAction(): Promise<BackupResult> {
  try {
    const supabase = await requireOwner();

    const tables: Record<string, Json[]> = {};
    for (const table of BACKUP_TABLES) {
      const { data, error } = await supabase.from(table).select("*").limit(100_000);
      if (error) throw new Error(`Failed to export ${table}: ${error.message}`);

      tables[table] =
        table === "aiwebsite_settings"
          ? (data ?? []).map((row) =>
              (row as { is_secret: boolean }).is_secret ? { ...row, value: "[redacted]" } : row
            )
          : (data ?? []);
    }

    const payload = {
      exportedAt: new Date().toISOString(),
      schemaVersion: "0001-0010",
      tables,
    };

    const json = JSON.stringify(payload, null, 2);
    const fileName = `aivexa-backup-${new Date().toISOString().slice(0, 10)}.json`;
    return {
      ok: true,
      message: `Exported ${BACKUP_TABLES.length} tables (${(json.length / 1024).toFixed(0)} KB).`,
      data: { json, fileName },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Export failed" };
  }
}
