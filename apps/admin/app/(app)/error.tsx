"use client";

import * as React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@aiwebsite/ui";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const looksLikeMissingMigration =
    /aiwebsite_|relation .* does not exist|schema cache/i.test(error.message);
  const looksLikeMissingEnv = /environment variable|placeholder/i.test(error.message);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Something went wrong
          </CardTitle>
          <CardDescription className="break-words">{error.message}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {looksLikeMissingMigration && (
            <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              This usually means the database migration has not been applied yet. Run{" "}
              <code className="font-mono text-xs">supabase/migrations/0001_foundation.sql</code> in
              your Supabase project&apos;s SQL editor, then retry.
            </p>
          )}
          {looksLikeMissingEnv && (
            <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              Check <code className="font-mono text-xs">apps/admin/.env.local</code> — one or more
              required variables are missing or still placeholders.
            </p>
          )}
          <Button onClick={reset}>
            <RotateCcw />
            Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
