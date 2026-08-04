import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, UserRow } from "../types";

type DB = SupabaseClient<Database>;

/** Total registered internal users. Used for first-user (owner) bootstrap. */
export async function countUsers(db: DB): Promise<number> {
  const { count, error } = await db
    .from("aiwebsite_users")
    .select("id", { count: "exact", head: true });
  if (error) throw new Error(`Failed to count users: ${error.message}`);
  return count ?? 0;
}

export async function getUserProfile(db: DB, id: string): Promise<UserRow | null> {
  const { data, error } = await db
    .from("aiwebsite_users")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(`Failed to load user profile: ${error.message}`);
  return data;
}

export async function updateUserName(db: DB, id: string, fullName: string): Promise<void> {
  const { error } = await db
    .from("aiwebsite_users")
    .update({ full_name: fullName })
    .eq("id", id);
  if (error) throw new Error(`Failed to update name: ${error.message}`);
}
