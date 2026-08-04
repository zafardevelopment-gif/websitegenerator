import type { Metadata } from "next";

import { createServerSupabase } from "@aiwebsite/db/server";
import { getUserProfile } from "@aiwebsite/db/users";

import { loadSlotsAction } from "@/lib/actions/slots";

import { SlotsManager } from "./slots-manager";

export const metadata: Metadata = {
  title: "Demo slots",
};

export default async function SlotsSettingsPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user ? await getUserProfile(supabase, user.id) : null;
  const { slots, counts, error } = await loadSlotsAction();

  return (
    <SlotsManager
      slots={slots}
      counts={counts}
      loadError={error}
      readOnly={profile?.role === "viewer"}
    />
  );
}
