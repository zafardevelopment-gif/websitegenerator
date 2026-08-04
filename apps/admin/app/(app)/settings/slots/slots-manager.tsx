"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ExternalLink,
  Loader2,
  Plus,
  Power,
  RefreshCw,
  RotateCcw,
  Server,
} from "lucide-react";
import { toast } from "sonner";

import type { DemoSlotWithHolder, SlotCounts } from "@aiwebsite/db/repositories/demo-slots";
import type { SlotStatus } from "@aiwebsite/db/types";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  cn,
} from "@aiwebsite/ui";

import {
  growPoolAction,
  releaseSlotAction,
  setSlotEnabledAction,
  sweepSlotsAction,
} from "@/lib/actions/slots";
import { formatDate } from "@/lib/format";
import { demoUrl } from "@/lib/urls";

/**
 * Demo slot pool view.
 *
 * The pool is the funnel's hard limit — you can run exactly as many live
 * pitches as you have free subdomains — so this screen leads with occupancy
 * and makes "who is holding what, and for how much longer" the primary read.
 */

const STATUS_STYLES: Record<SlotStatus, { label: string; className: string }> = {
  free: { label: "Free", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  occupied: { label: "In use", className: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  reserved: { label: "Reserved", className: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  cooldown: { label: "Cooling down", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  disabled: { label: "Disabled", className: "bg-muted text-muted-foreground" },
};

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400_000);
}

export function SlotsManager({
  slots,
  counts,
  loadError,
  readOnly,
}: {
  slots: DemoSlotWithHolder[];
  counts: SlotCounts;
  loadError?: string;
  readOnly: boolean;
}) {
  const [isPending, startTransition] = React.useTransition();
  const [busySlug, setBusySlug] = React.useState<string | null>(null);
  const [poolSize, setPoolSize] = React.useState(Math.max(counts.total, 10));

  function run(label: string, fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    startTransition(async () => {
      const result = await fn();
      if (result.ok) toast.success(result.message ?? label);
      else toast.error(result.error ?? "Something went wrong");
      setBusySlug(null);
    });
  }

  if (loadError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Demo slots unavailable
          </CardTitle>
          <CardDescription>{loadError}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const usable = counts.total - counts.disabled;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            Demo subdomain pool
          </CardTitle>
          <CardDescription>
            Demos publish onto a leased subdomain from this pool instead of a permanent slug. A
            slot returns automatically when the demo expires or the deal is lost, and passes
            through a short cooldown so a stale link can never show a different business.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Free" value={counts.free} tone="emerald" />
            <Stat label="In use" value={counts.occupied} tone="blue" />
            <Stat label="Cooling down" value={counts.cooldown} tone="amber" />
            <Stat label="Usable total" value={usable} tone="muted" />
          </div>

          {counts.free === 0 && usable > 0 && (
            <p className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              No free slots — the next publish will fail. Release a slot below or grow the pool.
            </p>
          )}

          <div className="flex flex-wrap items-end gap-3 border-t pt-5">
            <div className="w-40 space-y-1.5">
              <Label htmlFor="pool-size">Pool size</Label>
              <Input
                id="pool-size"
                type="number"
                min={1}
                max={200}
                value={poolSize}
                disabled={readOnly || isPending}
                onChange={(e) => setPoolSize(Number(e.target.value))}
              />
            </div>
            <Button
              variant="outline"
              disabled={readOnly || isPending || poolSize <= counts.total}
              onClick={() => run("Pool grown", () => growPoolAction(poolSize))}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Grow pool
            </Button>
            <Button
              variant="ghost"
              disabled={readOnly || isPending}
              onClick={() => run("Swept", () => sweepSlotsAction())}
            >
              <RefreshCw className="mr-1.5 h-4 w-4" />
              Run cooldown sweep
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            The pool only grows. To retire a subdomain that has already been shared with a
            prospect, disable it instead — the link keeps resolving to nothing rather than to
            someone else&rsquo;s business.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Slots</CardTitle>
          <CardDescription>{counts.total} subdomain(s) in the pool.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {slots.map((slot) => {
              const expiry = daysUntil(slot.expires_at);
              const cooldown = daysUntil(slot.cooldown_until);
              const style = STATUS_STYLES[slot.status];
              const busy = isPending && busySlug === slot.slug;

              return (
                <div
                  key={slot.slug}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-4"
                >
                  <div className="min-w-[9rem]">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium">{slot.slug}</span>
                      <Badge variant="secondary" className={cn("text-[11px]", style.className)}>
                        {style.label}
                      </Badge>
                    </div>
                    <a
                      href={demoUrl(slot.slug)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      open <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>

                  <div className="min-w-0 flex-1 text-sm">
                    {slot.lead ? (
                      <>
                        <Link
                          href={`/leads/${slot.lead.id}`}
                          className="font-medium hover:underline"
                        >
                          {slot.lead.business_name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {slot.site?.name ?? "—"} · lead status {slot.lead.status.replace(/_/g, " ")}
                        </p>
                      </>
                    ) : (
                      <span className="text-muted-foreground">
                        {slot.status === "cooldown"
                          ? cooldown !== null && cooldown > 0
                            ? `Free in ${cooldown} day${cooldown === 1 ? "" : "s"}`
                            : "Free at the next sweep"
                          : slot.status === "disabled"
                            ? "Out of rotation"
                            : "Available"}
                      </span>
                    )}
                  </div>

                  <div className="w-32 text-right text-xs text-muted-foreground">
                    {slot.status === "occupied" && expiry !== null ? (
                      <span className={cn(expiry <= 3 && "font-medium text-amber-600")}>
                        {expiry <= 0 ? "Expired" : `${expiry}d left`}
                        <span className="block">{formatDate(slot.expires_at)}</span>
                      </span>
                    ) : (
                      <span>{slot.lease_count > 0 ? `${slot.lease_count} leases` : "unused"}</span>
                    )}
                  </div>

                  <div className="flex gap-1.5">
                    {slot.status !== "disabled" && slot.status !== "free" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={readOnly || isPending}
                        onClick={() => {
                          setBusySlug(slot.slug);
                          run("Released", () =>
                            releaseSlotAction({
                              slug: slot.slug,
                              cooldownDays: slot.status === "cooldown" ? 0 : 3,
                              note: "released from pool view",
                            })
                          );
                        }}
                      >
                        {busy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3.5 w-3.5" />
                        )}
                        <span className="ml-1.5">
                          {slot.status === "cooldown" ? "Free now" : "Release"}
                        </span>
                      </Button>
                    )}
                    {!slot.site_id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={readOnly || isPending}
                        onClick={() => {
                          setBusySlug(slot.slug);
                          run("Updated", () =>
                            setSlotEnabledAction(slot.slug, slot.status === "disabled")
                          );
                        }}
                        title={slot.status === "disabled" ? "Return to rotation" : "Take out of rotation"}
                      >
                        <Power
                          className={cn(
                            "h-3.5 w-3.5",
                            slot.status === "disabled" && "text-muted-foreground"
                          )}
                        />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            {slots.length === 0 && (
              <p className="px-6 py-10 text-center text-sm text-muted-foreground">
                No slots yet — apply migration 0011 to seed demo1 … demo10.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "blue" | "amber" | "muted";
}) {
  const tones = {
    emerald: "text-emerald-600 dark:text-emerald-400",
    blue: "text-blue-600 dark:text-blue-400",
    amber: "text-amber-600 dark:text-amber-400",
    muted: "text-foreground",
  } as const;
  return (
    <div className="rounded-lg border p-4">
      <p className={cn("text-2xl font-semibold tabular-nums", tones[tone])}>{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
