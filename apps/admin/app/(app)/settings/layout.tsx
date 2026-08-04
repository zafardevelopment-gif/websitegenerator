import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";

import { createServerSupabase } from "@aiwebsite/db/server";
import { getUserProfile } from "@aiwebsite/db/users";

import { SettingsNav } from "./settings-nav";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user ? await getUserProfile(supabase, user.id) : null;
  const isOwner = profile?.role === "owner";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Agency profile, integrations and platform configuration.
        </p>
      </div>

      {!isOwner && (
        <div className="flex items-center gap-2 rounded-md border border-warning/50 bg-warning/10 p-3 text-sm">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          You have <span className="font-medium capitalize">{profile?.role}</span> access — settings
          are read-only. Only the owner can save changes.
        </div>
      )}

      <SettingsNav />
      {children}
    </div>
  );
}
