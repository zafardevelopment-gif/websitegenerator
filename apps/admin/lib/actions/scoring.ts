"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  computeLeadScore,
  normalizeScoringWeights,
  SETTING_KEYS,
  type ScoringWeights,
} from "@aiwebsite/config";
import { createServerSupabase } from "@aiwebsite/db/server";
import { getJsonSetting, saveJsonSetting } from "@aiwebsite/db/settings";
import { listActiveLeads, updateLead } from "@aiwebsite/db/repositories/leads";
import type { Json } from "@aiwebsite/db/types";

export type ScoringActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

const weightsSchema = z.object({
  ratingWeight: z.number().min(0).max(100),
  reviewsWeight: z.number().min(0).max(100),
  reviewSaturation: z.number().min(1).max(100000),
  noWebsiteWeight: z.number().min(0).max(100),
  defaultCategoryWeight: z.number().min(0).max(100),
  categoryOverrides: z.record(z.string().min(1).max(100), z.number().min(0).max(100)),
});

export async function saveScoringWeightsAction(input: unknown): Promise<ScoringActionResult> {
  const parsed = weightsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid weights" };
  }
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Not signed in." };

    await saveJsonSetting(
      supabase,
      SETTING_KEYS.scoringWeights,
      parsed.data as unknown as Json,
      user.id
    );
    revalidatePath("/settings/scoring");
    return { ok: true, message: "Scoring weights saved." };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save weights";
    return {
      ok: false,
      error: /row-level security/i.test(message) ? "Only the owner can change scoring." : message,
    };
  }
}

/** Re-scores every active lead with the current weights (capped at 5000). */
export async function recalculateScoresAction(): Promise<ScoringActionResult> {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Not signed in." };

    const weights: ScoringWeights = normalizeScoringWeights(
      await getJsonSetting(supabase, SETTING_KEYS.scoringWeights)
    );
    const leads = await listActiveLeads(supabase, 5000);

    let updated = 0;
    const chunkSize = 25;
    for (let i = 0; i < leads.length; i += chunkSize) {
      const chunk = leads.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map(async (lead) => {
          const score = computeLeadScore(
            {
              googleRating: lead.google_rating,
              reviewCount: lead.review_count,
              hasWebsite: lead.website !== null,
              category: lead.category,
            },
            weights
          );
          if (score !== lead.lead_score) {
            await updateLead(supabase, lead.id, { lead_score: score });
            updated += 1;
          }
        })
      );
    }

    revalidatePath("/leads");
    return { ok: true, message: `Recalculated ${leads.length} leads — ${updated} changed.` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Recalculation failed" };
  }
}
