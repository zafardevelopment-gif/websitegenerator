import type { Metadata } from "next";
import { Rocket } from "lucide-react";

import { createServerSupabase } from "@aiwebsite/db/server";
import { listSites } from "@aiwebsite/db/repositories/sites";
import type { DeploymentRow } from "@aiwebsite/db/types";

import { DeploymentsTable, type DeploymentSiteView } from "./deployments-table";

export const metadata: Metadata = {
  title: "Deployments",
};

export default async function DeploymentsPage() {
  const supabase = await createServerSupabase();
  const sites = await listSites(supabase, {}, 200);

  // Latest deployment per site (one query, newest first, pick first per site).
  const { data: recent } = await supabase
    .from("aiwebsite_deployments")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(400);
  const latestBySite = new Map<string, DeploymentRow>();
  for (const deployment of recent ?? []) {
    if (!latestBySite.has(deployment.site_id)) {
      latestBySite.set(deployment.site_id, deployment);
    }
  }

  const views: DeploymentSiteView[] = sites.map((site) => ({
    id: site.id,
    name: site.name,
    slug: site.slug,
    status: site.status,
    mode: site.mode,
    hasContent: site.current_version_id !== null,
    demoExpiresAt: site.demo_expires_at,
    publishedAt: site.published_at,
    lastAction: latestBySite.get(site.id)?.action ?? null,
    lastActionAt: latestBySite.get(site.id)?.created_at ?? null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Rocket className="h-6 w-6 text-muted-foreground" />
          Deployments
        </h1>
        <p className="text-sm text-muted-foreground">
          Publishing is a database flip + instant cache invalidation — live in seconds, SSL via
          the wildcard cert. Every action is audit-logged.
        </p>
      </div>
      <DeploymentsTable sites={views} />
    </div>
  );
}
