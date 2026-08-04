"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createServerSupabase } from "@aiwebsite/db/server";
import { getAgencyProfile } from "@aiwebsite/db/settings";
import { getLead, logLeadActivity, setLeadStatus } from "@aiwebsite/db/repositories/leads";
import {
  createQuotation,
  getQuotationWithItems,
  listQuotationsByLead,
  setQuotationStatus,
  updateQuotation,
} from "@aiwebsite/db/repositories/quotations";
import { listSites } from "@aiwebsite/db/repositories/sites";
import type { QuotationWithItems } from "@aiwebsite/db/repositories/quotations";
import type { QuotationRow, QuotationStatus } from "@aiwebsite/db/types";

import { demoUrl } from "../urls";

export type QuotationResult<T = undefined> =
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

const itemSchema = z.object({
  description: z.string().trim().min(1).max(300),
  quantity: z.number().min(0.01).max(9999),
  unit_price: z.number().min(0).max(10_000_000),
});

const createSchema = z.object({
  leadId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  currency: z.string().trim().min(1).max(8).default("INR"),
  gstEnabled: z.boolean(),
  gstRate: z.number().min(0).max(100),
  validUntil: z.string().trim().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  items: z.array(itemSchema).min(1).max(30),
});

export async function createQuotationAction(
  input: unknown
): Promise<QuotationResult<QuotationWithItems>> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid quotation" };

  try {
    const { supabase, user } = await requireUser();
    const lead = await getLead(supabase, parsed.data.leadId);
    if (!lead) return { ok: false, error: "Lead not found" };

    const quotation = await createQuotation(
      supabase,
      {
        lead_id: lead.id,
        title: parsed.data.title,
        currency: parsed.data.currency,
        gst_enabled: parsed.data.gstEnabled,
        gst_rate: parsed.data.gstRate,
        valid_until: parsed.data.validUntil || null,
        notes: parsed.data.notes || null,
        created_by: user.id,
      },
      parsed.data.items
    );

    await logLeadActivity(
      supabase,
      lead.id,
      "quotation",
      `Quotation ${quotation.quote_number} created (₹${quotation.total.toLocaleString("en-IN")})`,
      { quotation_id: quotation.id },
      user.id
    );

    revalidatePath(`/leads/${lead.id}`);
    return { ok: true, message: "Quotation created.", data: quotation };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

export async function listQuotationsAction(leadId: unknown): Promise<QuotationRow[]> {
  const parsed = z.string().uuid().safeParse(leadId);
  if (!parsed.success) return [];
  try {
    const { supabase } = await requireUser();
    return await listQuotationsByLead(supabase, parsed.data);
  } catch {
    return [];
  }
}

export async function getQuotationAction(id: unknown): Promise<QuotationWithItems | null> {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return null;
  try {
    const { supabase } = await requireUser();
    return await getQuotationWithItems(supabase, parsed.data);
  } catch {
    return null;
  }
}

const statusSchema = z.object({
  quotationId: z.string().uuid(),
  status: z.enum(["draft", "sent", "accepted", "rejected", "expired"]),
});

export async function setQuotationStatusAction(input: unknown): Promise<QuotationResult> {
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  try {
    const { supabase, user } = await requireUser();
    const quotation = await getQuotationWithItems(supabase, parsed.data.quotationId);
    if (!quotation) return { ok: false, error: "Quotation not found" };

    await setQuotationStatus(supabase, quotation.id, parsed.data.status as QuotationStatus);
    await logLeadActivity(
      supabase,
      quotation.lead_id,
      "quotation",
      `Quotation ${quotation.quote_number} marked ${parsed.data.status}`,
      { quotation_id: quotation.id },
      user.id
    );

    const lead = await getLead(supabase, quotation.lead_id);
    if (parsed.data.status === "sent" && lead && lead.status !== "won" && lead.status !== "lost") {
      await setLeadStatus(supabase, lead.id, "quotation_sent");
    }
    if (parsed.data.status === "accepted" && lead) {
      await setLeadStatus(supabase, lead.id, "won");
    }

    revalidatePath(`/leads/${quotation.lead_id}`);
    return { ok: true, message: `Quotation marked ${parsed.data.status}.` };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

const pdfSchema = z.object({ quotationId: z.string().uuid() });

export async function generateQuotationPdfAction(
  input: unknown
): Promise<QuotationResult<{ base64: string; fileName: string }>> {
  const parsed = pdfSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  try {
    const { supabase } = await requireUser();
    const quotation = await getQuotationWithItems(supabase, parsed.data.quotationId);
    if (!quotation) return { ok: false, error: "Quotation not found" };
    const lead = await getLead(supabase, quotation.lead_id);
    if (!lead) return { ok: false, error: "Lead not found" };

    const sites = await listSites(supabase, { leadId: lead.id }, 20);
    const site = sites.find((s) => s.status === "live" || s.status === "converted") ?? sites[0];
    const url = site ? demoUrl(site.slug) : "Not yet published";

    const agency = await getAgencyProfile(supabase);
    const { renderQuotationPdf } = await import("../server/quotation-pdf");
    const buffer = await renderQuotationPdf({
      agency: {
        name: agency.name || "AIVEXA LLP",
        whatsapp: agency.whatsapp,
        email: agency.email,
        address: agency.address,
        gstNo: agency.gst_no,
      },
      businessName: lead.business_name,
      demoUrl: url,
      quotation,
    });

    return {
      ok: true,
      message: "Quotation PDF generated.",
      data: {
        base64: buffer.toString("base64"),
        fileName: `${quotation.quote_number}-${lead.business_name.replace(/[^a-z0-9]+/gi, "-")}.pdf`,
      },
    };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

// Update (line items / GST / notes) before a quotation is sent.
const updateSchema = z.object({
  quotationId: z.string().uuid(),
  title: z.string().trim().min(1).max(200).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  validUntil: z.string().trim().nullable().optional(),
});

export async function updateQuotationAction(input: unknown): Promise<QuotationResult> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  try {
    const { supabase } = await requireUser();
    const quotation = await getQuotationWithItems(supabase, parsed.data.quotationId);
    if (!quotation) return { ok: false, error: "Quotation not found" };

    await updateQuotation(supabase, quotation.id, {
      title: parsed.data.title,
      notes: parsed.data.notes,
      valid_until: parsed.data.validUntil,
    });
    revalidatePath(`/leads/${quotation.lead_id}`);
    return { ok: true, message: "Quotation updated." };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}
