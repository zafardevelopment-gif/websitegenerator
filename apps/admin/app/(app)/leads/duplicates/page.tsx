import type { Metadata } from "next";
import { Copy } from "lucide-react";

import { createServerSupabase } from "@aiwebsite/db/server";
import { findDuplicateGroups } from "@aiwebsite/db/repositories/merge";

import { LeadsViewNav } from "../leads-view-nav";
import { DuplicateGroups } from "./duplicate-groups";

export const metadata: Metadata = {
  title: "Duplicates",
};

export default async function DuplicatesPage() {
  const supabase = await createServerSupabase();
  const groups = await findDuplicateGroups(supabase);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Copy className="h-6 w-6 text-muted-foreground" />
            Duplicates
            <span className="text-base font-normal text-muted-foreground">
              ({groups.length} group{groups.length === 1 ? "" : "s"})
            </span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Leads sharing a phone number or Google Place ID. Merging keeps one lead, moves all
            history onto it, and trashes the other.
          </p>
        </div>
        <LeadsViewNav />
      </div>
      <DuplicateGroups groups={groups} />
    </div>
  );
}
