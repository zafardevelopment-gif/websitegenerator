"use client";

import * as React from "react";
import { Eye, MessageCircle, Monitor, Smartphone, Tablet, Users } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@aiwebsite/ui";

import { getSiteAnalyticsAction, type SiteAnalyticsSnapshot } from "@/lib/actions/analytics";
import { formatRelative } from "@/lib/format";

const DEVICE_ICON = { mobile: Smartphone, tablet: Tablet, desktop: Monitor, other: Monitor } as const;

function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border p-4 text-center">
      <Icon className="mx-auto mb-1.5 h-5 w-5 text-muted-foreground" />
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export function AnalyticsPanel({
  siteId,
  open,
  onOpenChange,
}: {
  siteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [snapshot, setSnapshot] = React.useState<SiteAnalyticsSnapshot | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setLoading(true);
    void getSiteAnalyticsAction(siteId).then((result) => {
      setSnapshot(result);
      setLoading(false);
    });
  }, [open, siteId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Engagement analytics</DialogTitle>
          <DialogDescription>
            First-party, cookieless tracking. Internal/bot visits are excluded.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : !snapshot ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No engagement data yet — publish the site and share the link to start tracking.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <StatTile icon={Eye} label="Total visits" value={snapshot.totalVisits} />
              <StatTile icon={Users} label="Unique visitors" value={snapshot.uniqueVisitors} />
              <StatTile icon={MessageCircle} label="CTA clicks" value={snapshot.ctaClicks} />
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Recent visits</p>
              {snapshot.recentVisits.length === 0 ? (
                <p className="text-sm text-muted-foreground">No visits recorded yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {snapshot.recentVisits.map((visit, i) => {
                    const Icon = DEVICE_ICON[visit.deviceType];
                    return (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">{visit.path}</span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {formatRelative(visit.createdAt)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
