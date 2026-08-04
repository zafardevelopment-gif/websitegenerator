import type { Metadata } from "next";
import { Map } from "lucide-react";

import { createServerSupabase } from "@aiwebsite/db/server";
import { listActiveLeads } from "@aiwebsite/db/repositories/leads";

import { LeadsViewNav } from "../leads-view-nav";
import { LeadsMapLoader } from "./leads-map-loader";

export const metadata: Metadata = {
  title: "Lead map",
};

export default async function LeadsMapPage() {
  const supabase = await createServerSupabase();
  const leads = await listActiveLeads(supabase, 1000);
  const withCoords = leads.filter((l) => l.latitude !== null && l.longitude !== null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Map className="h-6 w-6 text-muted-foreground" />
            Lead map
          </h1>
          <p className="text-sm text-muted-foreground">
            {withCoords.length} of {leads.length} leads have coordinates — markers are colored by
            status.
          </p>
        </div>
        <LeadsViewNav />
      </div>
      <LeadsMapLoader leads={withCoords} />
    </div>
  );
}
