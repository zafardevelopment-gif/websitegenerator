import type { Metadata } from "next";
import { Upload } from "lucide-react";

import { createServerSupabase } from "@aiwebsite/db/server";
import { listImports } from "@aiwebsite/db/repositories/imports";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@aiwebsite/ui";

import { formatDateTime } from "@/lib/format";

import { LeadsViewNav } from "../leads-view-nav";
import { ImportWizard } from "./import-wizard";

export const metadata: Metadata = {
  title: "Import leads",
};

const STATUS_VARIANT = {
  pending: "secondary",
  processing: "secondary",
  completed: "success",
  failed: "destructive",
} as const;

export default async function ImportPage() {
  const supabase = await createServerSupabase();
  const imports = await listImports(supabase, 20);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Upload className="h-6 w-6 text-muted-foreground" />
            Import leads
          </h1>
          <p className="text-sm text-muted-foreground">
            CSV or JSON, any column layout — map columns, review, import. Extra columns are kept
            on each lead as raw data.
          </p>
        </div>
        <LeadsViewNav />
      </div>

      <ImportWizard />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Import history</CardTitle>
        </CardHeader>
        <CardContent>
          {imports.length === 0 ? (
            <p className="text-sm text-muted-foreground">No imports yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">File</th>
                    <th className="py-2 pr-4 font-medium">When</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 text-right font-medium">Rows</th>
                    <th className="py-2 pr-4 text-right font-medium">Imported</th>
                    <th className="py-2 pr-4 text-right font-medium">Duplicates</th>
                    <th className="py-2 text-right font-medium">Skipped</th>
                  </tr>
                </thead>
                <tbody>
                  {imports.map((batch) => (
                    <tr key={batch.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">{batch.file_name}</td>
                      <td className="whitespace-nowrap py-2 pr-4 text-muted-foreground">
                        {formatDateTime(batch.created_at)}
                      </td>
                      <td className="py-2 pr-4">
                        <Badge variant={STATUS_VARIANT[batch.status]}>{batch.status}</Badge>
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">{batch.total_rows}</td>
                      <td className="py-2 pr-4 text-right tabular-nums text-success">
                        {batch.imported_rows}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">{batch.duplicate_rows}</td>
                      <td className="py-2 text-right tabular-nums text-muted-foreground">
                        {batch.skipped_rows}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
