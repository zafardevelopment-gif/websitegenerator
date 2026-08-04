"use client";

import * as React from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@aiwebsite/ui";

import { exportFullBackupAction } from "@/lib/actions/backup";

export function BackupExportCard({ readOnly }: { readOnly: boolean }) {
  const [pending, startTransition] = React.useTransition();

  function runExport() {
    startTransition(async () => {
      const result = await exportFullBackupAction();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const blob = new Blob([result.data.json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.data.fileName;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(result.message);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Backup & export</CardTitle>
        <CardDescription>
          Download every table as one JSON file — leads, sites, quotations, payments, clients,
          domains, media, messages, and settings. Secret API key values are redacted; re-enter them
          manually after a restore.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={runExport} disabled={pending || readOnly}>
          {pending ? <Loader2 className="animate-spin" /> : <Download />}
          Export full backup (JSON)
        </Button>
        {readOnly && (
          <p className="mt-2 text-xs text-muted-foreground">Only the owner can run a full export.</p>
        )}
      </CardContent>
    </Card>
  );
}
