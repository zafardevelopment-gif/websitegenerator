import "server-only";

import type { Database, DbClient, PaymentRow } from "../types";
import { fail } from "./_helpers";

type PaymentInsert = Database["public"]["Tables"]["aiwebsite_payments"]["Insert"];
type PaymentUpdate = Database["public"]["Tables"]["aiwebsite_payments"]["Update"];

export async function createPayment(db: DbClient, input: PaymentInsert): Promise<PaymentRow> {
  const { data, error } = await db.from("aiwebsite_payments").insert(input).select("*").single();
  if (error || !data) fail("Failed to create payment", error);
  return data;
}

export async function updatePayment(
  db: DbClient,
  id: string,
  patch: PaymentUpdate
): Promise<PaymentRow> {
  const { data, error } = await db
    .from("aiwebsite_payments")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) fail("Failed to update payment", error);
  return data;
}

/** Webhook handlers locate payments by their Razorpay payment-link id. */
export async function getPaymentByLinkId(
  db: DbClient,
  razorpayLinkId: string
): Promise<PaymentRow | null> {
  const { data, error } = await db
    .from("aiwebsite_payments")
    .select("*")
    .eq("razorpay_link_id", razorpayLinkId)
    .maybeSingle();
  if (error) fail("Failed to look up payment", error);
  return data;
}

export async function listPaymentsByLead(db: DbClient, leadId: string): Promise<PaymentRow[]> {
  const { data, error } = await db
    .from("aiwebsite_payments")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });
  if (error) fail("Failed to list payments", error);
  return data ?? [];
}
