"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";

import type { LeadRow, LeadStatus } from "@aiwebsite/db/types";
import { cn } from "@aiwebsite/ui";

import { RatingCell } from "@/components/lead-badges";
import { setLeadStatusAction } from "@/lib/actions/leads";
import { LEAD_STATUSES, LEAD_STATUS_LABELS, PRIORITY_CLASSES } from "@/lib/lead-meta";

export function KanbanBoard({ initialLeads }: { initialLeads: LeadRow[] }) {
  const [leads, setLeads] = React.useState(initialLeads);
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [dragOver, setDragOver] = React.useState<LeadStatus | null>(null);
  const [, startTransition] = React.useTransition();

  React.useEffect(() => setLeads(initialLeads), [initialLeads]);

  const byStatus = React.useMemo(() => {
    const map = new Map<LeadStatus, LeadRow[]>(LEAD_STATUSES.map((s) => [s, []]));
    for (const lead of leads) map.get(lead.status)?.push(lead);
    return map;
  }, [leads]);

  function drop(status: LeadStatus) {
    setDragOver(null);
    const id = dragId;
    setDragId(null);
    if (!id) return;
    const lead = leads.find((l) => l.id === id);
    if (!lead || lead.status === status) return;

    const previous = lead.status;
    // Optimistic move; revert on failure.
    setLeads((all) => all.map((l) => (l.id === id ? { ...l, status } : l)));
    startTransition(async () => {
      const result = await setLeadStatusAction(id, status);
      if (!result.ok) {
        setLeads((all) => all.map((l) => (l.id === id ? { ...l, status: previous } : l)));
        toast.error(result.error);
      } else {
        toast.success(`${lead.business_name} → ${LEAD_STATUS_LABELS[status]}`);
      }
    });
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {LEAD_STATUSES.map((status) => {
        const column = byStatus.get(status) ?? [];
        return (
          <section
            key={status}
            aria-label={LEAD_STATUS_LABELS[status]}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(status);
            }}
            onDragLeave={() => setDragOver((s) => (s === status ? null : s))}
            onDrop={() => drop(status)}
            className={cn(
              "flex max-h-[75vh] w-64 shrink-0 flex-col rounded-lg border bg-muted/30 transition-colors",
              dragOver === status && "border-primary bg-primary/5"
            )}
          >
            <header className="flex items-center justify-between border-b px-3 py-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {LEAD_STATUS_LABELS[status]}
              </h2>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                {column.length}
              </span>
            </header>
            <div className="flex-1 space-y-2 overflow-y-auto p-2">
              {column.length === 0 && (
                <p className="py-6 text-center text-xs text-muted-foreground/60">Empty</p>
              )}
              {column.map((lead) => (
                <article
                  key={lead.id}
                  draggable
                  onDragStart={() => setDragId(lead.id)}
                  onDragEnd={() => setDragId(null)}
                  className={cn(
                    "cursor-grab space-y-1.5 rounded-md border bg-card p-3 shadow-sm transition-opacity active:cursor-grabbing",
                    dragId === lead.id && "opacity-40"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/leads/${lead.id}`}
                      className="text-sm font-medium leading-snug hover:text-primary hover:underline"
                    >
                      {lead.business_name}
                    </Link>
                    <span
                      className={cn(
                        "mt-0.5 h-2 w-2 shrink-0 rounded-full",
                        lead.priority === "high" && "bg-destructive",
                        lead.priority === "medium" && "bg-warning",
                        lead.priority === "low" && "bg-muted-foreground/40"
                      )}
                      title={`Priority: ${lead.priority}`}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {[lead.category, lead.area].filter(Boolean).join(" · ") || "—"}
                  </p>
                  <div className="flex items-center justify-between">
                    <RatingCell rating={lead.google_rating} reviews={lead.review_count} />
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                        PRIORITY_CLASSES[lead.priority]
                      )}
                    >
                      {lead.lead_score}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
