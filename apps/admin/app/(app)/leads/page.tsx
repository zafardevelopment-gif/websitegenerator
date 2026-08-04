import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Users } from "lucide-react";

import { createServerSupabase } from "@aiwebsite/db/server";
import {
  listLeads,
  type LeadFilters,
  type LeadSort,
  type LeadSortColumn,
} from "@aiwebsite/db/repositories/leads";
import type { LeadStatus, Priority } from "@aiwebsite/db/types";
import { Button } from "@aiwebsite/ui";

import { LEAD_STATUSES } from "@/lib/lead-meta";

import { LeadsTable } from "./leads-table";
import { LeadsToolbar } from "./leads-toolbar";
import { LeadsViewNav } from "./leads-view-nav";

export const metadata: Metadata = {
  title: "Leads",
};

const PAGE_SIZE = 25;

const SORTABLE: LeadSortColumn[] = [
  "created_at",
  "updated_at",
  "business_name",
  "lead_score",
  "google_rating",
  "next_follow_up",
  "last_contacted_at",
];

interface LeadsSearchParams {
  q?: string;
  status?: string;
  priority?: string;
  category?: string;
  tag?: string;
  view?: string;
  page?: string;
  sort?: string;
  dir?: string;
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<LeadsSearchParams>;
}) {
  const params = await searchParams;

  const filters: LeadFilters = {
    search: params.q?.trim() || undefined,
    status: LEAD_STATUSES.includes(params.status as LeadStatus)
      ? (params.status as LeadStatus)
      : undefined,
    priority: ["high", "medium", "low"].includes(params.priority ?? "")
      ? (params.priority as Priority)
      : undefined,
    category: params.category?.trim() || undefined,
    tag: params.tag?.trim() || undefined,
    view: params.view === "deleted" ? "deleted" : "active",
  };

  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const sort: LeadSort = {
    column: SORTABLE.includes(params.sort as LeadSortColumn)
      ? (params.sort as LeadSortColumn)
      : "created_at",
    ascending: params.dir === "asc",
  };

  const supabase = await createServerSupabase();
  const { rows, count } = await listLeads(supabase, filters, { page, pageSize: PAGE_SIZE }, sort);
  const pageCount = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Users className="h-6 w-6 text-muted-foreground" />
            Leads
            <span className="text-base font-normal text-muted-foreground">({count})</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            {filters.view === "deleted"
              ? "Trash — deleted leads can be restored."
              : "Your local-business pipeline."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LeadsViewNav />
          <Button asChild>
            <Link href="/leads/new">
              <Plus />
              New lead
            </Link>
          </Button>
        </div>
      </div>

      <LeadsToolbar />

      <LeadsTable
        rows={rows}
        count={count}
        page={page}
        pageCount={pageCount}
        pageSize={PAGE_SIZE}
        trashView={filters.view === "deleted"}
      />
    </div>
  );
}
