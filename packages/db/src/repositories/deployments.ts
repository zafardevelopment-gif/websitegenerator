import "server-only";

import type { DbClient, DeployAction, DeploymentRow, DeployStatus, Json } from "../types";
import { fail } from "./_helpers";

export async function startDeployment(
  db: DbClient,
  siteId: string,
  action: DeployAction,
  actorId: string | null
): Promise<DeploymentRow> {
  const { data, error } = await db
    .from("aiwebsite_deployments")
    .insert({ site_id: siteId, action, actor_id: actorId })
    .select("*")
    .single();
  if (error || !data) fail("Failed to record deployment", error);
  return data;
}

export async function completeDeployment(
  db: DbClient,
  id: string,
  status: Exclude<DeployStatus, "pending">,
  message: string | null,
  logs: Json = []
): Promise<void> {
  const { error } = await db
    .from("aiwebsite_deployments")
    .update({ status, message, logs, completed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) fail("Failed to complete deployment", error);
}

export async function listDeployments(
  db: DbClient,
  siteId: string,
  limit = 50
): Promise<DeploymentRow[]> {
  const { data, error } = await db
    .from("aiwebsite_deployments")
    .select("*")
    .eq("site_id", siteId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) fail("Failed to list deployments", error);
  return data ?? [];
}
