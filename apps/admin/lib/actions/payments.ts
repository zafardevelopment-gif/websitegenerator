"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createServerSupabase } from "@aiwebsite/db/server";
import { getLead, logLeadActivity } from "@aiwebsite/db/repositories/leads";
import { createPayment, listPaymentsByLead } from "@aiwebsite/db/repositories/payments";
import { getQuotationWithItems } from "@aiwebsite/db/repositories/quotations";
import type { PaymentRow } from "@aiwebsite/db/types";

import { createPaymentLink } from "../server/razorpay";

export type PaymentResult<T = undefined> =
  | { ok: true; message: string; data?: T }
  | { ok: false; error: string };

function friendly(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e);
  if (/row-level security/i.test(message)) return "You don't have permission for that.";
  return message;
}

async function requireUser() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  return { supabase, user };
}

const createLinkSchema = z.object({
  quotationId: z.string().uuid(),
  amountInr: z.number().min(1).max(10_000_000),
  purpose: z.enum(["advance", "full", "renewal"]),
});

export async function createPaymentLinkAction(
  input: unknown
): Promise<PaymentResult<{ shortUrl: string }>> {
  const parsed = createLinkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  try {
    const { supabase, user } = await requireUser();
    const quotation = await getQuotationWithItems(supabase, parsed.data.quotationId);
    if (!quotation) return { ok: false, error: "Quotation not found" };
    const lead = await getLead(supabase, quotation.lead_id);
    if (!lead) return { ok: false, error: "Lead not found" };

    const payment = await createPayment(supabase, {
      lead_id: lead.id,
      quotation_id: quotation.id,
      provider: "razorpay",
      amount: parsed.data.amountInr,
      currency: "INR",
      status: "created",
      purpose: parsed.data.purpose,
      created_by: user.id,
    });

    const link = await createPaymentLink({
      amountInr: parsed.data.amountInr,
      description: `${parsed.data.purpose === "renewal" ? "Renewal" : "Payment"} — ${quotation.quote_number} — ${lead.business_name}`,
      referenceId: payment.id,
      customerName: lead.business_name,
      customerContact: lead.phone,
      customerEmail: lead.email,
    });

    await import("@aiwebsite/db/repositories/payments").then(({ updatePayment }) =>
      updatePayment(supabase, payment.id, { razorpay_link_id: link.id, status: "pending" })
    );

    await logLeadActivity(
      supabase,
      lead.id,
      "payment",
      `Payment link created for ₹${parsed.data.amountInr.toLocaleString("en-IN")} (${parsed.data.purpose})`,
      { payment_id: payment.id },
      user.id
    );

    revalidatePath(`/leads/${lead.id}`);
    return { ok: true, message: "Payment link created.", data: { shortUrl: link.shortUrl } };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

export async function listPaymentsAction(leadId: unknown): Promise<PaymentRow[]> {
  const parsed = z.string().uuid().safeParse(leadId);
  if (!parsed.success) return [];
  try {
    const { supabase } = await requireUser();
    return await listPaymentsByLead(supabase, parsed.data);
  } catch {
    return [];
  }
}
