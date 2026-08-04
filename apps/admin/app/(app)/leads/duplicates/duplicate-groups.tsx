"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, GitMerge, Loader2 } from "lucide-react";
import { toast } from "sonner";

import type { DuplicateGroup, MergeableField } from "@aiwebsite/db/repositories/merge";
import type { LeadRow } from "@aiwebsite/db/types";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@aiwebsite/ui";

import { LeadStatusBadge, RatingCell } from "@/components/lead-badges";
import { mergeLeadsAction } from "@/lib/actions/merge";
import { formatDate } from "@/lib/format";

/** Fields shown for side-by-side conflict resolution. */
const COMPARE_FIELDS: { key: MergeableField; label: string }[] = [
  { key: "business_name", label: "Business name" },
  { key: "owner_name", label: "Owner" },
  { key: "phone", label: "Phone" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "email", label: "Email" },
  { key: "website", label: "Website" },
  { key: "category", label: "Category" },
  { key: "google_rating", label: "Rating" },
  { key: "review_count", label: "Reviews" },
  { key: "address", label: "Address" },
  { key: "area", label: "Area" },
  { key: "city", label: "City" },
  { key: "notes", label: "Notes" },
];

export function DuplicateGroups({ groups }: { groups: DuplicateGroup[] }) {
  const [merging, setMerging] = React.useState<{ a: LeadRow; b: LeadRow } | null>(null);

  if (groups.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
          <CheckCircle2 className="h-10 w-10 text-success" />
          <p className="font-medium">No duplicates found</p>
          <p className="text-sm text-muted-foreground">
            Every active lead has a unique phone number and Place ID.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <Card key={group.key}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              Matched on{" "}
              <Badge variant="secondary" className="font-mono text-xs">
                {group.key}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {group.leads.map((lead) => (
              <div
                key={lead.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
              >
                <div className="min-w-0">
                  <Link
                    href={`/leads/${lead.id}`}
                    className="font-medium hover:text-primary hover:underline"
                  >
                    {lead.business_name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {[lead.area, lead.city].filter(Boolean).join(", ") || "—"} · created{" "}
                    {formatDate(lead.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <RatingCell rating={lead.google_rating} reviews={lead.review_count} />
                  <LeadStatusBadge status={lead.status} />
                </div>
              </div>
            ))}
            {group.leads.length >= 2 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setMerging({ a: group.leads[0] as LeadRow, b: group.leads[1] as LeadRow })
                }
              >
                <GitMerge />
                Merge first two…
              </Button>
            )}
          </CardContent>
        </Card>
      ))}

      {merging && (
        <MergeDialog pair={merging} onClose={() => setMerging(null)} />
      )}
    </div>
  );
}

function MergeDialog({ pair, onClose }: { pair: { a: LeadRow; b: LeadRow }; onClose: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [primaryId, setPrimaryId] = React.useState(pair.a.id);
  const [choices, setChoices] = React.useState<Partial<Record<MergeableField, "primary" | "duplicate">>>({});

  const primary = primaryId === pair.a.id ? pair.a : pair.b;
  const duplicate = primaryId === pair.a.id ? pair.b : pair.a;

  const conflicts = COMPARE_FIELDS.filter(({ key }) => {
    const a = primary[key];
    const b = duplicate[key];
    return a !== null && b !== null && String(a) !== String(b);
  });

  function submit() {
    startTransition(async () => {
      const result = await mergeLeadsAction({
        primaryId: primary.id,
        duplicateId: duplicate.id,
        fieldChoices: choices,
      });
      if (result.ok) {
        toast.success(result.message);
        onClose();
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Merge duplicates</DialogTitle>
          <DialogDescription>
            Empty fields on the kept lead are filled from the duplicate automatically; resolve
            conflicting fields below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {[pair.a, pair.b].map((lead) => (
              <button
                key={lead.id}
                type="button"
                onClick={() => {
                  setPrimaryId(lead.id);
                  setChoices({});
                }}
                className={`rounded-md border p-3 text-left transition-colors ${
                  primaryId === lead.id
                    ? "border-primary bg-primary/5"
                    : "hover:border-muted-foreground/40"
                }`}
              >
                <p className="text-sm font-medium">{lead.business_name}</p>
                <p className="text-xs text-muted-foreground">
                  {primaryId === lead.id ? "✓ Keep this lead" : "Will be merged & trashed"}
                </p>
              </button>
            ))}
          </div>

          {conflicts.length > 0 ? (
            <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border p-3">
              {conflicts.map(({ key, label }) => (
                <div key={key} className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">{label}</p>
                  <div className="grid gap-1 sm:grid-cols-2">
                    {(["primary", "duplicate"] as const).map((side) => {
                      const lead = side === "primary" ? primary : duplicate;
                      const selected = (choices[key] ?? "primary") === side;
                      return (
                        <label
                          key={side}
                          className={`flex cursor-pointer items-center gap-2 rounded border px-2 py-1.5 text-xs ${
                            selected ? "border-primary bg-primary/5" : ""
                          }`}
                        >
                          <input
                            type="radio"
                            name={`merge-${key}`}
                            className="accent-[var(--primary)]"
                            checked={selected}
                            onChange={() => setChoices((c) => ({ ...c, [key]: side }))}
                          />
                          <span className="truncate">{String(lead[key])}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No conflicting fields — merge is safe.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isPending}>
            {isPending ? <Loader2 className="animate-spin" /> : <GitMerge />}
            Merge into “{primary.business_name}”
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
