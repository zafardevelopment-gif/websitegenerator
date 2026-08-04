import type { Metadata } from "next";

import { normalizeScoringWeights, SETTING_KEYS } from "@aiwebsite/config";
import { createServerSupabase } from "@aiwebsite/db/server";
import { getJsonSetting } from "@aiwebsite/db/settings";
import { getUserProfile } from "@aiwebsite/db/users";

import { ScoringForm } from "./scoring-form";

export const metadata: Metadata = {
  title: "Scoring",
};

export default async function ScoringSettingsPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user ? await getUserProfile(supabase, user.id) : null;
  const weights = normalizeScoringWeights(
    await getJsonSetting(supabase, SETTING_KEYS.scoringWeights)
  );

  return <ScoringForm weights={weights} readOnly={profile?.role !== "owner"} />;
}
