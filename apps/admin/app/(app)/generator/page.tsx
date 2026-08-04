import type { Metadata } from "next";
import Link from "next/link";
import { Globe, Pencil } from "lucide-react";

import { createServerSupabase } from "@aiwebsite/db/server";
import { listSites } from "@aiwebsite/db/repositories/sites";
import { Badge, Card, CardContent } from "@aiwebsite/ui";

import { formatRelative } from "@/lib/format";

import { NewSitePicker } from "./new-site-picker";

export const metadata: Metadata = {
  title: "Generator",
};

const STATUS_VARIANT = {
  draft: "secondary",
  live: "success",
  paused: "warning",
  expired: "destructive",
  archived: "outline",
  converted: "default",
} as const;

export default async function GeneratorPage() {
  const supabase = await createServerSupabase();
  const sites = await listSites(supabase, {}, 100);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Globe className="h-6 w-6 text-muted-foreground" />
            Website generator
          </h1>
          <p className="text-sm text-muted-foreground">
            Lead → template → AI content → edit → deploy. Target: under 3 minutes.
          </p>
        </div>
        <NewSitePicker />
      </div>

      {sites.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            No websites yet. Pick a lead above to generate the first one.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sites.map((site) => (
            <Link key={site.id} href={`/generator/${site.id}`} className="group">
              <Card className="h-full transition-all group-hover:-translate-y-0.5 group-hover:shadow-md">
                <CardContent className="space-y-2 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium leading-snug group-hover:text-primary">
                      {site.name}
                    </p>
                    <Badge variant={STATUS_VARIANT[site.status]}>{site.status}</Badge>
                  </div>
                  <p className="font-mono text-xs text-muted-foreground">{site.slug}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Updated {formatRelative(site.updated_at)}</span>
                    <span className="inline-flex items-center gap-1 text-primary opacity-0 transition-opacity group-hover:opacity-100">
                      <Pencil className="h-3 w-3" />
                      Open editor
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
