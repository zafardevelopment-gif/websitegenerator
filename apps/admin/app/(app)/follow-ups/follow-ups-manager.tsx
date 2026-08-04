"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  List,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import type { FollowUpWithLead } from "@aiwebsite/db/repositories/follow-ups";
import {
  Badge,
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@aiwebsite/ui";

import {
  cancelFollowUpAction,
  completeFollowUpAction,
  snoozeFollowUpAction,
} from "@/lib/actions/follow-ups";
import { formatDateTime } from "@/lib/format";

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function bucketFor(dueIso: string): "overdue" | "today" | "upcoming" {
  const due = dayKey(dueIso);
  const today = new Date().toISOString().slice(0, 10);
  if (due < today) return "overdue";
  if (due === today) return "today";
  return "upcoming";
}

const BUCKET_LABEL = { overdue: "Overdue", today: "Today", upcoming: "Upcoming" } as const;
const BUCKET_ORDER = ["overdue", "today", "upcoming"] as const;

export function FollowUpsManager({ initialFollowUps }: { initialFollowUps: FollowUpWithLead[] }) {
  const router = useRouter();
  const [view, setView] = React.useState<"list" | "calendar">("list");
  const [snoozeTarget, setSnoozeTarget] = React.useState<FollowUpWithLead | null>(null);
  const [snoozeDate, setSnoozeDate] = React.useState(addDays(2));
  const [isPending, startTransition] = React.useTransition();
  const [monthOffset, setMonthOffset] = React.useState(0);

  const grouped = React.useMemo(() => {
    const groups: Record<string, FollowUpWithLead[]> = { overdue: [], today: [], upcoming: [] };
    for (const f of initialFollowUps) groups[bucketFor(f.due_at)]?.push(f);
    return groups;
  }, [initialFollowUps]);

  function run(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(result.message ?? "Done.");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed.");
      }
    });
  }

  function submitSnooze() {
    if (!snoozeTarget) return;
    startTransition(async () => {
      const result = await snoozeFollowUpAction({ id: snoozeTarget.id, dueDate: snoozeDate });
      if (result.ok) {
        toast.success(result.message);
        setSnoozeTarget(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  // Calendar grid for the displayed month.
  const calendarMonth = React.useMemo(() => {
    const base = new Date();
    base.setDate(1);
    base.setMonth(base.getMonth() + monthOffset);
    const year = base.getFullYear();
    const month = base.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: { date: string | null }[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push({ date: null });
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push({ date: `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}` });
    }
    return { label: base.toLocaleDateString("en-IN", { month: "long", year: "numeric" }), cells };
  }, [monthOffset]);

  const byDay = React.useMemo(() => {
    const map = new Map<string, FollowUpWithLead[]>();
    for (const f of initialFollowUps) {
      const key = dayKey(f.due_at);
      const list = map.get(key) ?? [];
      list.push(f);
      map.set(key, list);
    }
    return map;
  }, [initialFollowUps]);

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {(
          [
            ["list", "List", List],
            ["calendar", "Calendar", CalendarIcon],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
              view === key ? "bg-background font-medium shadow-sm" : "text-muted-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {view === "list" ? (
        <div className="space-y-6">
          {BUCKET_ORDER.map((bucket) => {
            const items = grouped[bucket] ?? [];
            if (items.length === 0 && bucket !== "overdue" && bucket !== "today") return null;
            return (
              <div key={bucket}>
                <h2
                  className={cn(
                    "mb-2 flex items-center gap-2 text-sm font-semibold",
                    bucket === "overdue" && items.length > 0 && "text-destructive"
                  )}
                >
                  <Clock className="h-4 w-4" />
                  {BUCKET_LABEL[bucket]}
                  <Badge variant="outline">{items.length}</Badge>
                </h2>
                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing here.</p>
                ) : (
                  <div className="space-y-2">
                    {items.map((f) => (
                      <div
                        key={f.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
                      >
                        <div className="min-w-0">
                          <Link
                            href={`/leads/${f.lead_id}`}
                            className="font-medium hover:text-primary hover:underline"
                          >
                            {f.lead?.business_name ?? "Unknown lead"}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(f.due_at)}
                            {f.status === "snoozed" && " · snoozed"}
                          </p>
                          {f.note && <p className="text-sm text-muted-foreground">{f.note}</p>}
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isPending}
                            onClick={() =>
                              run(() => completeFollowUpAction({ id: f.id, leadId: f.lead_id }))
                            }
                          >
                            <Check />
                            Done
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isPending}
                            onClick={() => {
                              setSnoozeTarget(f);
                              setSnoozeDate(addDays(2));
                            }}
                          >
                            <Clock />
                            Snooze
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            disabled={isPending}
                            onClick={() => run(() => cancelFollowUpAction({ id: f.id }))}
                          >
                            <X />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => setMonthOffset((m) => m - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <p className="font-medium">{calendarMonth.label}</p>
            <Button variant="ghost" size="icon" onClick={() => setMonthOffset((m) => m + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calendarMonth.cells.map((cell, i) => {
              const items = cell.date ? (byDay.get(cell.date) ?? []) : [];
              const isToday = cell.date === new Date().toISOString().slice(0, 10);
              return (
                <div
                  key={i}
                  className={cn(
                    "min-h-20 rounded-md border p-1.5 text-xs",
                    !cell.date && "border-transparent",
                    isToday && "border-primary bg-primary/5"
                  )}
                >
                  {cell.date && (
                    <>
                      <p className="mb-1 text-muted-foreground">{cell.date.slice(-2)}</p>
                      {items.slice(0, 3).map((f) => (
                        <Link
                          key={f.id}
                          href={`/leads/${f.lead_id}`}
                          className="mb-0.5 block truncate rounded bg-muted px-1 py-0.5 hover:bg-accent"
                          title={f.lead?.business_name}
                        >
                          {f.lead?.business_name ?? "Lead"}
                        </Link>
                      ))}
                      {items.length > 3 && (
                        <p className="text-muted-foreground">+{items.length - 3} more</p>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Dialog open={snoozeTarget !== null} onOpenChange={(open) => !open && setSnoozeTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Snooze follow-up</DialogTitle>
            <DialogDescription>{snoozeTarget?.lead?.business_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="snooze-date">New date</Label>
            <Input
              id="snooze-date"
              type="date"
              value={snoozeDate}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setSnoozeDate(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSnoozeTarget(null)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={submitSnooze} disabled={isPending}>
              {isPending ? <Loader2 className="animate-spin" /> : <Clock />}
              Snooze
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
