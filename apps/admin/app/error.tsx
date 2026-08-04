"use client";

import * as React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@aiwebsite/ui";

/** Catches errors in routes outside the (app) group — currently just /login. */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Something went wrong
          </CardTitle>
          <CardDescription className="break-words">{error.message}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={reset}>
            <RotateCcw />
            Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
