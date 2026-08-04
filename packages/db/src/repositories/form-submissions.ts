import "server-only";

import type { Database, DbClient, FormSubmissionRow } from "../types";
import { fail } from "./_helpers";

type SubmissionInsert = Database["public"]["Tables"]["aiwebsite_form_submissions"]["Insert"];

/** Called by the public form endpoint with the service-role client. */
export async function createFormSubmission(
  db: DbClient,
  input: SubmissionInsert
): Promise<FormSubmissionRow> {
  const { data, error } = await db
    .from("aiwebsite_form_submissions")
    .insert(input)
    .select("*")
    .single();
  if (error || !data) fail("Failed to save form submission", error);
  return data;
}

export async function listFormSubmissions(
  db: DbClient,
  siteId: string,
  limit = 100
): Promise<FormSubmissionRow[]> {
  const { data, error } = await db
    .from("aiwebsite_form_submissions")
    .select("*")
    .eq("site_id", siteId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) fail("Failed to list form submissions", error);
  return data ?? [];
}

export async function markSubmissionRead(db: DbClient, id: string): Promise<void> {
  const { error } = await db
    .from("aiwebsite_form_submissions")
    .update({ is_read: true })
    .eq("id", id);
  if (error) fail("Failed to mark submission read", error);
}
