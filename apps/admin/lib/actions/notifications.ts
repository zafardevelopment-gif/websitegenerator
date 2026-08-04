"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createServerSupabase } from "@aiwebsite/db/server";
import {
  countUnreadNotifications,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@aiwebsite/db/repositories/notifications";
import type { NotificationRow } from "@aiwebsite/db/types";

export interface NotificationsSnapshot {
  unread: number;
  recent: NotificationRow[];
}

export async function getNotificationsSnapshotAction(): Promise<NotificationsSnapshot> {
  try {
    const supabase = await createServerSupabase();
    const [unread, recent] = await Promise.all([
      countUnreadNotifications(supabase),
      listNotifications(supabase, 15),
    ]);
    return { unread, recent };
  } catch {
    return { unread: 0, recent: [] };
  }
}

export async function markNotificationReadAction(id: unknown): Promise<{ ok: boolean }> {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false };
  try {
    const supabase = await createServerSupabase();
    await markNotificationRead(supabase, parsed.data);
    revalidatePath("/");
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function markAllNotificationsReadAction(): Promise<{ ok: boolean }> {
  try {
    const supabase = await createServerSupabase();
    await markAllNotificationsRead(supabase);
    revalidatePath("/");
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
