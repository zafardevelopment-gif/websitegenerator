import "server-only";

import type { Database, DbClient, MessageRow } from "../types";
import { fail } from "./_helpers";

type MessageInsert = Database["public"]["Tables"]["aiwebsite_messages"]["Insert"];
type MessageUpdate = Database["public"]["Tables"]["aiwebsite_messages"]["Update"];

export async function createMessage(db: DbClient, input: MessageInsert): Promise<MessageRow> {
  const { data, error } = await db.from("aiwebsite_messages").insert(input).select("*").single();
  if (error || !data) fail("Failed to save message", error);
  return data;
}

export async function updateMessage(
  db: DbClient,
  id: string,
  patch: MessageUpdate
): Promise<MessageRow> {
  const { data, error } = await db
    .from("aiwebsite_messages")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) fail("Failed to update message", error);
  return data;
}

export async function listMessagesByLead(
  db: DbClient,
  leadId: string,
  limit = 100
): Promise<MessageRow[]> {
  const { data, error } = await db
    .from("aiwebsite_messages")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) fail("Failed to list messages", error);
  return data ?? [];
}

/** Used by the email open-tracking pixel (service-role, no auth context). */
export async function getMessageByOpenToken(
  db: DbClient,
  openToken: string
): Promise<MessageRow | null> {
  const { data, error } = await db
    .from("aiwebsite_messages")
    .select("*")
    .eq("open_token", openToken)
    .maybeSingle();
  if (error) fail("Failed to look up message by open token", error);
  return data;
}
