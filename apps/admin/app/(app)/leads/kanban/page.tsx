import type { Metadata } from "next";
import { Kanban } from "lucide-react";

import { createServerSupabase } from "@aiwebsite/db/server";
import { listActiveLeads } from "@aiwebsite/db/repositories/leads";

import { LeadsViewNav } from "../leads-view-nav";
import { KanbanBoard } from "./kanban-board";

export const metadata: Metadata = {
  title: "Pipeline",
};

export default async function KanbanPage() {
  const supabase = await createServerSupabase();
  const leads = await listActiveLeads(supabase, 1000);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Kanban className="h-6 w-6 text-muted-foreground" />
            Pipeline
          </h1>
          <p className="text-sm text-muted-foreground">
            Drag cards between columns to change status — every move is logged on the timeline.
          </p>
        </div>
        <LeadsViewNav />
      </div>
      <KanbanBoard initialLeads={leads} />
    </div>
  );
}
