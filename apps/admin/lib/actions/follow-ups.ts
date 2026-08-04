"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createServerSupabase } from "@aiwebsite/db/server";
import {
  cancelFollowUp,
  completeFollowUp,
  createFollowUp,
  listActiveFollowUpsWithLead,
  snoozeFollowUp,
  type FollowUpWithLead,
} from "@aiwebsite/db/repositories/follow-ups";
import { logLeadActivity } from "@aiwebsite/db/repositories/leads";

export type FollowUpResult = { ok: true; message: string } | { ok: false; error: string };

function friendly(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e);
  if (/row-level security/i.test(message)) return "You don't have permission for that.";
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

export async function listFollowUpsAction(): Promise<FollowUpWithLead[]> {
  try {
    const { supabase } = await requireUser();
    return await listActiveFollowUpsWithLead(supabase);
  } catch {
    return [];
  }
}

const createSchema = z.object({
  leadId: z.string().uuid(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  note: z.string().trim().max(1000),
});

export async function createFollowUpAction(input: unknown): Promise<FollowUpResult> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  try {
    const { supabase, user } = await requireUser();
    const dueAt = new Date(`${parsed.data.dueDate}T10:00:00`).toISOString();
    await createFollowUp(supabase, {
      lead_id: parsed.data.leadId,
      due_at: dueAt,
      note: parsed.data.note || null,
      created_by: user.id,
    });
    revalidatePath("/follow-ups");
    revalidatePath(`/leads/${parsed.data.leadId}`);
    return { ok: true, message: "Follow-up scheduled." };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

const snoozeSchema = z.object({
  id: z.string().uuid(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
});

export async function snoozeFollowUpAction(input: unknown): Promise<FollowUpResult> {
  const parsed = snoozeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  try {
    const { supabase } = await requireUser();
    const dueAt = new Date(`${parsed.data.dueDate}T10:00:00`).toISOString();
    await snoozeFollowUp(supabase, parsed.data.id, dueAt);
    revalidatePath("/follow-ups");
    return { ok: true, message: "Snoozed." };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

const idSchema = z.object({ id: z.string().uuid(), leadId: z.string().uuid().optional() });

export async function completeFollowUpAction(input: unknown): Promise<FollowUpResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  try {
    const { supabase, user } = await requireUser();
    await completeFollowUp(supabase, parsed.data.id);
    if (parsed.data.leadId) {
      await logLeadActivity(supabase, parsed.data.leadId, "follow_up", "Follow-up completed", {}, user.id);
    }
    revalidatePath("/follow-ups");
    if (parsed.data.leadId) revalidatePath(`/leads/${parsed.data.leadId}`);
    return { ok: true, message: "Marked done." };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

export async function cancelFollowUpAction(input: unknown): Promise<FollowUpResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  try {
    const { supabase } = await requireUser();
    await cancelFollowUp(supabase, parsed.data.id);
    revalidatePath("/follow-ups");
    return { ok: true, message: "Cancelled." };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}
