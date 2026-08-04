"use client";

import * as React from "react";
import { Download, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import type { HealthScoreRow } from "@aiwebsite/db/types";
import {
  Badge,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Button,
} from "@aiwebsite/ui";

import {
  generateAuditPdfAction,
  getLatestHealthScoreAction,
  runHealthScoreAction,
} from "@/lib/actions/health-score";
import { formatDateTime } from "@/lib/format";

function scoreColor(score: number | null): string {
  if (score === null) return "text-muted-foreground";
  if (score >= 90) return "text-success";
  if (score >= 50) return "text-warning";
  return "text-destructive";
}

function ScoreTile({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <p className={`text-2xl font-semibold tabular-nums ${scoreColor(value)}`}>{value ?? "—"}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

interface AuditShape {
  strengths?: string[];
  weaknesses?: string[];
  summary?: string;
}

function downloadBase64Pdf(base64: string, fileName: string) {
  const bytes = atob(base64);
  const array = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) array[i] = bytes.charCodeAt(i);
  const blob = new Blob([array], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function HealthScorePanel({
  siteId,
  open,
  onOpenChange,
}: {
  siteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [score, setScore] = React.useState<HealthScoreRow | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [running, startRunning] = React.useTransition();
  const [exporting, startExporting] = React.useTransition();

  React.useEffect(() => {
    if (!open) return;
    setLoading(true);
    void getLatestHealthScoreAction(siteId).then((result) => {
      setScore(result);
      setLoading(false);
    });
  }, [open, siteId]);

  function run() {
    startRunning(async () => {
      const result = await runHealthScoreAction({ siteId });
      if (result.ok) {
        toast.success(result.message);
        if (result.data) setScore(result.data);
      } else {
        toast.error(result.error);
      }
    });
  }

  function exportPdf() {
    if (!score) return;
    startExporting(async () => {
      const result = await generateAuditPdfAction({ siteId, healthScoreId: score.id });
      if (result.ok && result.data) {
        downloadBase64Pdf(result.data.base64, result.data.fileName);
        toast.success(result.message);
      } else if (!result.ok) {
        toast.error(result.error);
      }
    });
  }

  const audit = (score?.ai_audit ?? {}) as AuditShape;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            Website Health Score
          </DialogTitle>
          <DialogDescription>
            Google PageSpeed Insights + an AI audit of strengths, weaknesses, and recommendations.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : !score ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              No audit yet — publish the site, then run one. Takes ~20-30 seconds.
            </p>
            <Button onClick={run} disabled={running}>
              {running ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              Run health score
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant="outline">Last run {formatDateTime(score.created_at)}</Badge>
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" onClick={run} disabled={running}>
                  {running ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                  Re-run
                </Button>
                <Button variant="outline" size="sm" onClick={exportPdf} disabled={exporting}>
                  {exporting ? <Loader2 className="animate-spin" /> : <Download />}
                  Client PDF
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <ScoreTile label="Overall" value={score.overall_score} />
              <ScoreTile label="SEO" value={score.seo_score} />
              <ScoreTile label="Performance" value={score.performance_score} />
              <ScoreTile label="Accessibility" value={score.accessibility_score} />
              <ScoreTile label="Best Practices" value={score.best_practices_score} />
              <ScoreTile label="Mobile" value={score.mobile_score} />
              <ScoreTile label="Desktop" value={score.desktop_score} />
            </div>

            {audit.summary && <p className="text-sm">{audit.summary}</p>}

            {(audit.strengths?.length ?? 0) > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">What&apos;s working</p>
                <ul className="list-inside list-disc space-y-0.5 text-sm">
                  {audit.strengths!.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {(audit.weaknesses?.length ?? 0) > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Issues found</p>
                <ul className="list-inside list-disc space-y-0.5 text-sm">
                  {audit.weaknesses!.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
