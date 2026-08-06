import type { Metadata } from "next";
import { Search } from "lucide-react";

import { LeadsViewNav } from "../leads-view-nav";
import { FindLeadsPanel } from "./find-leads-panel";

export const metadata: Metadata = {
  title: "Find leads",
};

export default function FindLeadsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Search className="h-6 w-6 text-muted-foreground" />
            Find leads (Google)
          </h1>
          <p className="text-sm text-muted-foreground">
            Search Google Maps by city and business type, filter by rating/website/phone, then
            import the ones you want.
          </p>
        </div>
        <LeadsViewNav />
      </div>

      <FindLeadsPanel />
    </div>
  );
}
