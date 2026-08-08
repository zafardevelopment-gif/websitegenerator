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

/** Idempotency check for the inbound webhook and delivery-status callbacks. */
export async function getMessageByExternalId(
  db: DbClient,
  externalId: string
): Promise<MessageRow | null> {
  const { data, error } = await db
    .from("aiwebsite_messages")
    .select("*")
    .eq("external_id", externalId)
    .maybeSingle();
  if (error) fail("Failed to look up message by external id", error);
  return data;
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

export interface WhatsAppStats {
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  repliesIn: number;
  /** Distinct leads that have replied at least once, over the same window. */
  repliedLeads: number;
  /** repliedLeads / sent — 0 when nothing has been sent yet. */
  replyRate: number;
}

/** Outbound + inbound WhatsApp counts over the last `days` — powers the dashboard's outreach card. */
export async function getWhatsAppStats(db: DbClient, days = 30): Promise<WhatsAppStats> {
  const sinceIso = new Date(Date.now() - days * 86400_000).toISOString();
  const { data, error } = await db
    .from("aiwebsite_messages")
    .select("lead_id, status, direction")
    .eq("channel", "whatsapp")
    .gte("created_at", sinceIso)
    .limit(50000);
  if (error) fail("Failed to load WhatsApp stats", error);

  const rows = data ?? [];
  const outbound = rows.filter((r) => r.direction === "outbound");
  const inbound = rows.filter((r) => r.direction === "inbound");

  const sent = outbound.length;
  const delivered = outbound.filter((r) => r.status === "delivered" || r.status === "opened" || r.status === "read").length;
  const read = outbound.filter((r) => r.status === "opened" || r.status === "read").length;
  const failed = outbound.filter((r) => r.status === "failed").length;
  const repliedLeads = new Set(inbound.map((r) => r.lead_id)).size;

  return {
    sent,
    delivered,
    read,
    failed,
    repliesIn: inbound.length,
    repliedLeads,
    replyRate: sent > 0 ? repliedLeads / sent : 0,
  };
}

export interface RecentReply {
  id: string;
  leadId: string;
  businessName: string;
  body: string;
  createdAt: string;
}

/** Most recent inbound WhatsApp replies — for the dashboard's live feed. */
export async function listRecentWhatsAppReplies(db: DbClient, limit = 10): Promise<RecentReply[]> {
  const { data, error } = await db
    .from("aiwebsite_messages")
    .select("id, lead_id, body, created_at, lead:aiwebsite_leads(business_name)")
    .eq("channel", "whatsapp")
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) fail("Failed to load recent replies", error);
  return (data ?? []).map((r) => {
    const lead = r.lead as unknown as { business_name: string } | { business_name: string }[] | null;
    const businessName = Array.isArray(lead) ? (lead[0]?.business_name ?? "Unknown") : (lead?.business_name ?? "Unknown");
    return {
      id: r.id,
      leadId: r.lead_id,
      businessName,
      body: r.body,
      createdAt: r.created_at,
    };
  });
}
