import type { Metadata } from "next";

import { createServerSupabase } from "@aiwebsite/db/server";
import { getUserProfile } from "@aiwebsite/db/users";

import { loadAiConfig } from "@/lib/server/ai-engine";

import { AiConfigForm } from "./ai-config-form";

export const metadata: Metadata = {
  title: "AI Engine",
};

export default async function AiSettingsPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user ? await getUserProfile(supabase, user.id) : null;
  const config = await loadAiConfig(supabase);

  return <AiConfigForm config={config} readOnly={profile?.role !== "owner"} />;
}
