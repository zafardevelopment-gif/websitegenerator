import "server-only";

import type { Channel, Database, DbClient, MessageTemplateRow } from "../types";
import { fail } from "./_helpers";

type TemplateInsert = Database["public"]["Tables"]["aiwebsite_message_templates"]["Insert"];
type TemplateUpdate = Database["public"]["Tables"]["aiwebsite_message_templates"]["Update"];

export async function listMessageTemplates(
  db: DbClient,
  channel?: Channel
): Promise<MessageTemplateRow[]> {
  let query = db.from("aiwebsite_message_templates").select("*").eq("is_active", true);
  if (channel) query = query.eq("channel", channel);
  const { data, error } = await query.order("key");
  if (error) fail("Failed to list message templates", error);
  return data ?? [];
}

export async function getMessageTemplate(
  db: DbClient,
  key: string
): Promise<MessageTemplateRow | null> {
  const { data, error } = await db
    .from("aiwebsite_message_templates")
    .select("*")
    .eq("key", key)
    .eq("is_active", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) fail("Failed to load message template", error);
  return data;
}

export async function createMessageTemplate(
  db: DbClient,
  input: TemplateInsert
): Promise<MessageTemplateRow> {
  const { data, error } = await db
    .from("aiwebsite_message_templates")
    .insert(input)
    .select("*")
    .single();
  if (error || !data) fail("Failed to create message template", error);
  return data;
}

export async function updateMessageTemplate(
  db: DbClient,
  id: string,
  patch: TemplateUpdate
): Promise<MessageTemplateRow> {
  const { data, error } = await db
    .from("aiwebsite_message_templates")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) fail("Failed to update message template", error);
  return data;
}
