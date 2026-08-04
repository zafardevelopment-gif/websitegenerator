import "server-only";

import type { Database, DbClient, QuotationItemRow, QuotationRow, QuotationStatus } from "../types";
import { fail } from "./_helpers";

type QuotationInsert = Database["public"]["Tables"]["aiwebsite_quotations"]["Insert"];
type QuotationUpdate = Database["public"]["Tables"]["aiwebsite_quotations"]["Update"];

export interface QuotationItemInput {
  description: string;
  quantity: number;
  unit_price: number;
  sort_order?: number;
}

export interface QuotationWithItems extends QuotationRow {
  items: QuotationItemRow[];
}

function computeTotals(items: QuotationItemInput[], gstEnabled: boolean, gstRate: number) {
  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
  const gstAmount = gstEnabled ? (subtotal * gstRate) / 100 : 0;
  return {
    subtotal: Number(subtotal.toFixed(2)),
    gst_amount: Number(gstAmount.toFixed(2)),
    total: Number((subtotal + gstAmount).toFixed(2)),
  };
}

export async function createQuotation(
  db: DbClient,
  input: Omit<QuotationInsert, "subtotal" | "gst_amount" | "total">,
  items: QuotationItemInput[]
): Promise<QuotationWithItems> {
  const totals = computeTotals(items, input.gst_enabled ?? true, input.gst_rate ?? 18);
  const { data: quotation, error } = await db
    .from("aiwebsite_quotations")
    .insert({ ...input, ...totals })
    .select("*")
    .single();
  if (error || !quotation) fail("Failed to create quotation", error);

  const itemRows = items.map((item, index) => ({
    quotation_id: quotation.id,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    amount: Number((item.quantity * item.unit_price).toFixed(2)),
    sort_order: item.sort_order ?? index,
  }));
  const { data: savedItems, error: itemsError } = await db
    .from("aiwebsite_quotation_items")
    .insert(itemRows)
    .select("*");
  if (itemsError) fail("Failed to save quotation items", itemsError);

  return { ...quotation, items: savedItems ?? [] };
}

export async function getQuotationWithItems(
  db: DbClient,
  id: string
): Promise<QuotationWithItems | null> {
  const { data: quotation, error } = await db
    .from("aiwebsite_quotations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) fail("Failed to load quotation", error);
  if (!quotation) return null;

  const { data: items, error: itemsError } = await db
    .from("aiwebsite_quotation_items")
    .select("*")
    .eq("quotation_id", id)
    .order("sort_order");
  if (itemsError) fail("Failed to load quotation items", itemsError);

  return { ...quotation, items: items ?? [] };
}

export async function listQuotationsByLead(db: DbClient, leadId: string): Promise<QuotationRow[]> {
  const { data, error } = await db
    .from("aiwebsite_quotations")
    .select("*")
    .eq("lead_id", leadId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) fail("Failed to list quotations", error);
  return data ?? [];
}

export async function updateQuotation(
  db: DbClient,
  id: string,
  patch: QuotationUpdate
): Promise<QuotationRow> {
  const { data, error } = await db
    .from("aiwebsite_quotations")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) fail("Failed to update quotation", error);
  return data;
}

export async function setQuotationStatus(
  db: DbClient,
  id: string,
  status: QuotationStatus
): Promise<void> {
  const patch: QuotationUpdate = { status };
  if (status === "sent") patch.sent_at = new Date().toISOString();
  if (status === "accepted" || status === "rejected") {
    patch.decided_at = new Date().toISOString();
  }
  const { error } = await db.from("aiwebsite_quotations").update(patch).eq("id", id);
  if (error) fail("Failed to update quotation status", error);
}
