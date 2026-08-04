import { Star } from "lucide-react";

import type { LeadStatus, Priority } from "@aiwebsite/db/types";
import { cn } from "@aiwebsite/ui";

import {
  LEAD_STATUS_CLASSES,
  LEAD_STATUS_LABELS,
  PRIORITY_CLASSES,
  PRIORITY_LABELS,
} from "@/lib/lead-meta";

export function LeadStatusBadge({ status, className }: { status: LeadStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium",
        LEAD_STATUS_CLASSES[status],
        className
      )}
    >
      {LEAD_STATUS_LABELS[status]}
    </span>
  );
}

export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium",
        PRIORITY_CLASSES[priority],
        className
      )}
    >
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

export function RatingCell({
  rating,
  reviews,
}: {
  rating: number | null;
  reviews: number | null;
}) {
  if (rating === null) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap text-sm">
      <Star className="h-3.5 w-3.5 fill-warning text-warning" />
      {rating.toFixed(1)}
      {reviews !== null && <span className="text-xs text-muted-foreground">({reviews})</span>}
    </span>
  );
}
