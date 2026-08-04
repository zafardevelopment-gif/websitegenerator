import "server-only";

import type { AuditLogRow, DbClient } from "../types";
import { fail, pageRange, type PageParams } from "./_helpers";

export interface AuditListResult {
  rows: AuditLogRow[];
  count: number;
}

export async function listAuditLogs(
  db: DbClient,
  page: PageParams,
  filters: { tableName?: string; recordId?: string } = {}
): Promise<AuditListResult> {
  let query = db.from("aiwebsite_audit_logs").select("*", { count: "exact" });
  if (filters.tableName) query = query.eq("table_name", filters.tableName);
  if (filters.recordId) query = query.eq("record_id", filters.recordId);

  const { from, to } = pageRange(page);
  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) fail("Failed to list audit logs", error);
  return { rows: data ?? [], count: count ?? 0 };
}
