import "server-only";

import type { Database, DbClient, NotificationRow } from "../types";
import { fail } from "./_helpers";

type NotificationInsert = Database["public"]["Tables"]["aiwebsite_notifications"]["Insert"];

/** Called by the service-role tracking ingest endpoint. */
export async function createNotification(
  db: DbClient,
  input: NotificationInsert
): Promise<NotificationRow> {
  const { data, error } = await db
    .from("aiwebsite_notifications")
    .insert(input)
    .select("*")
    .single();
  if (error || !data) fail("Failed to create notification", error);
  return data;
}

export async function listNotifications(
  db: DbClient,
  limit = 30
): Promise<NotificationRow[]> {
  const { data, error } = await db
    .from("aiwebsite_notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) fail("Failed to list notifications", error);
  return data ?? [];
}

export async function countUnreadNotifications(db: DbClient): Promise<number> {
  const { count, error } = await db
    .from("aiwebsite_notifications")
    .select("id", { count: "exact", head: true })
    .eq("is_read", false);
  if (error) fail("Failed to count notifications", error);
  return count ?? 0;
}

export async function markNotificationRead(db: DbClient, id: string): Promise<void> {
  const { error } = await db
    .from("aiwebsite_notifications")
    .update({ is_read: true })
    .eq("id", id);
  if (error) fail("Failed to mark notification read", error);
}

export async function markAllNotificationsRead(db: DbClient): Promise<void> {
  const { error } = await db
    .from("aiwebsite_notifications")
    .update({ is_read: true })
    .eq("is_read", false);
  if (error) fail("Failed to mark notifications read", error);
}
