"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createServerSupabase } from "@aiwebsite/db/server";
import {
  MERGEABLE_FIELDS,
  mergeLeads,
  type MergeableField,
} from "@aiwebsite/db/repositories/merge";

export type MergeResult = { ok: true; message: string } | { ok: false; error: string };

const mergeSchema = z.object({
  primaryId: z.string().uuid(),
  duplicateId: z.string().uuid(),
  fieldChoices: z.record(
    z.enum(MERGEABLE_FIELDS as unknown as [MergeableField, ...MergeableField[]]),
    z.enum(["primary", "duplicate"])
  ),
});

export async function mergeLeadsAction(input: unknown): Promise<MergeResult> {
  const parsed = mergeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid merge request" };
  if (parsed.data.primaryId === parsed.data.duplicateId) {
    return { ok: false, error: "Pick two different leads" };
  }

  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Not signed in." };

    await mergeLeads(
      supabase,
      parsed.data.primaryId,
      parsed.data.duplicateId,
      parsed.data.fieldChoices,
      user.id
    );
    revalidatePath("/leads");
    revalidatePath("/leads/duplicates");
    revalidatePath(`/leads/${parsed.data.primaryId}`);
    return { ok: true, message: "Leads merged. The duplicate was moved to trash." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Merge failed" };
  }
}
