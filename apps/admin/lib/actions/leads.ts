"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  computeLeadScore,
  normalizeScoringWeights,
  SETTING_KEYS,
} from "@aiwebsite/config";
import { createServerSupabase } from "@aiwebsite/db/server";
import { getJsonSetting } from "@aiwebsite/db/settings";
import {
  addLeadNote,
  createLead,
  logLeadActivity,
  restoreLead,
  searchLeads,
  setLeadStatus,
  softDeleteLead,
  updateLead,
} from "@aiwebsite/db/repositories/leads";
import { createFollowUp } from "@aiwebsite/db/repositories/follow-ups";
import type { Database, LeadRow, LeadStatus } from "@aiwebsite/db/types";

import { getSlotForSite, releaseSlotForSite } from "@aiwebsite/db/repositories/demo-slots";
import { listSites, updateSite } from "@aiwebsite/db/repositories/sites";

import { autoSuggestFollowUp } from "../server/follow-up-suggest";
import { followUpSchema, leadFormSchema, noteSchema, type LeadFormInput } from "../validation/leads";

export type LeadActionResult =
  | { ok: true; message: string; leadId?: string }
  | { ok: false; error: string };

type LeadInsert = Database["public"]["Tables"]["aiwebsite_leads"]["Insert"];

const LEAD_STATUSES: readonly LeadStatus[] = [
  "new", "website_generated", "demo_deployed", "whatsapp_sent", "demo_viewed",
  "waiting", "interested", "meeting", "quotation_sent", "negotiation", "won", "lost",
];

function friendlyError(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e);
  if (/row-level security/i.test(message)) return "You don't have permission for that.";
  if (/does not exist|schema cache/i.test(message)) {
    return "Database schema missing — apply supabase/APPLY_ALL.sql first.";
  }
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

const nullIfEmpty = (v: string): string | null => (v === "" ? null : v);

/** Maps validated form values to a DB insert/patch. */
function toDbPatch(values: LeadFormInput, userId: string): LeadInsert {
  return {
    business_name: values.business_name,
    category: nullIfEmpty(values.category),
    business_description: nullIfEmpty(values.business_description),
    owner_name: nullIfEmpty(values.owner_name),
    phone: nullIfEmpty(values.phone),
    whatsapp: nullIfEmpty(values.whatsapp) ?? nullIfEmpty(values.phone),
    email: nullIfEmpty(values.email),
    website: nullIfEmpty(values.website),
    instagram: nullIfEmpty(values.instagram),
    facebook: nullIfEmpty(values.facebook),
    linkedin: nullIfEmpty(values.linkedin),
    google_rating: values.google_rating === "" ? null : Number(values.google_rating),
    review_count: values.review_count === "" ? null : Number(values.review_count),
    address: nullIfEmpty(values.address),
    area: nullIfEmpty(values.area),
    city: nullIfEmpty(values.city),
    state: nullIfEmpty(values.state),
    country: values.country || "India",
    pincode: nullIfEmpty(values.pincode),
    google_maps_url: nullIfEmpty(values.google_maps_url),
    place_id: nullIfEmpty(values.place_id),
    services: values.services
      ? values.services.split(",").map((s) => s.trim()).filter(Boolean)
      : [],
    lead_source: nullIfEmpty(values.lead_source),
    tags: values.tags
      ? values.tags.split(",").map((t) => t.trim().toLowerCase().replace(/\s+/g, "-")).filter(Boolean)
      : [],
    priority: values.priority,
    next_follow_up: values.next_follow_up ? new Date(values.next_follow_up).toISOString() : null,
    notes: nullIfEmpty(values.notes),
    created_by: userId,
  };
}

/** Auto-scores a lead patch using the configurable weights (SRS US-2.6). */
async function withScore(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  patch: LeadInsert
): Promise<LeadInsert> {
  const weights = normalizeScoringWeights(
    await getJsonSetting(supabase, SETTING_KEYS.scoringWeights)
  );
  return {
    ...patch,
    lead_score: computeLeadScore(
      {
        googleRating: patch.google_rating ?? null,
        reviewCount: patch.review_count ?? null,
        hasWebsite: (patch.website ?? null) !== null,
        category: patch.category ?? null,
      },
      weights
    ),
  };
}

export async function createLeadAction(input: unknown): Promise<LeadActionResult> {
  const parsed = leadFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    const { supabase, user } = await requireUser();
    const lead = await createLead(supabase, await withScore(supabase, toDbPatch(parsed.data, user.id)));
    revalidatePath("/leads");
    return { ok: true, message: "Lead created.", leadId: lead.id };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

export async function updateLeadAction(leadId: unknown, input: unknown): Promise<LeadActionResult> {
  const idParsed = z.string().uuid().safeParse(leadId);
  const parsed = leadFormSchema.safeParse(input);
  if (!idParsed.success) return { ok: false, error: "Invalid lead id" };
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    const { supabase, user } = await requireUser();
    const patch = await withScore(supabase, toDbPatch(parsed.data, user.id));
    delete (patch as { created_by?: string | null }).created_by;
    await updateLead(supabase, idParsed.data, patch);
    revalidatePath("/leads");
    revalidatePath(`/leads/${idParsed.data}`);
    return { ok: true, message: "Lead updated.", leadId: idParsed.data };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

/**
 * Release every demo slot held by this lead's sites and retire the site's
 * copy of the slug so the subdomain can be leased again.
 */
async function releaseSlotsForLead(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  leadId: string,
  note: string
): Promise<string[]> {
  const sites = await listSites(supabase, { leadId });
  const released: string[] = [];
  for (const site of sites) {
    const slot = await getSlotForSite(supabase, site.id);
    if (!slot) continue;
    if (site.slug === slot.slug) {
      const suffix = site.id.replace(/-/g, "").slice(0, 6);
      await updateSite(supabase, site.id, { slug: `${slot.slug}-${suffix}` });
    }
    await releaseSlotForSite(supabase, site.id, { note });
    released.push(slot.slug);
  }
  return released;
}

export async function setLeadStatusAction(leadId: unknown, status: unknown): Promise<LeadActionResult> {
  const parsed = z
    .object({ leadId: z.string().uuid(), status: z.enum(LEAD_STATUSES as [LeadStatus, ...LeadStatus[]]) })
    .safeParse({ leadId, status });
  if (!parsed.success) return { ok: false, error: "Invalid status change" };
  try {
    const { supabase, user } = await requireUser();
    await setLeadStatus(supabase, parsed.data.leadId, parsed.data.status);
    await autoSuggestFollowUp(supabase, parsed.data.leadId, parsed.data.status, user.id);

    // A lost deal frees its demo subdomain immediately. A won deal keeps it
    // until the client's own domain is live — that hand-off releases the
    // slot (roadmap Phase 7), so we deliberately don't touch it here.
    let extra = "";
    if (parsed.data.status === "lost") {
      const released = await releaseSlotsForLead(supabase, parsed.data.leadId, "deal lost");
      if (released.length > 0) extra = ` ${released.join(", ")} returned to the pool.`;
    }

    revalidatePath("/leads");
    revalidatePath(`/leads/${parsed.data.leadId}`);
    revalidatePath("/follow-ups");
    revalidatePath("/settings/slots");
    return { ok: true, message: `Status updated.${extra}` };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

export async function deleteLeadAction(leadId: unknown): Promise<LeadActionResult> {
  const parsed = z.string().uuid().safeParse(leadId);
  if (!parsed.success) return { ok: false, error: "Invalid lead id" };
  try {
    const { supabase } = await requireUser();
    await softDeleteLead(supabase, parsed.data);
    revalidatePath("/leads");
    return { ok: true, message: "Lead moved to trash." };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

export async function restoreLeadAction(leadId: unknown): Promise<LeadActionResult> {
  const parsed = z.string().uuid().safeParse(leadId);
  if (!parsed.success) return { ok: false, error: "Invalid lead id" };
  try {
    const { supabase } = await requireUser();
    await restoreLead(supabase, parsed.data);
    revalidatePath("/leads");
    return { ok: true, message: "Lead restored." };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

export async function addLeadNoteAction(input: unknown): Promise<LeadActionResult> {
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid note" };
  }
  try {
    const { supabase, user } = await requireUser();
    await addLeadNote(supabase, parsed.data.leadId, parsed.data.note, user.id);
    revalidatePath(`/leads/${parsed.data.leadId}`);
    return { ok: true, message: "Note added." };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

export async function addFollowUpAction(input: unknown): Promise<LeadActionResult> {
  const parsed = followUpSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid follow-up" };
  }
  try {
    const { supabase, user } = await requireUser();
    const dueAt = new Date(`${parsed.data.dueDate}T09:00:00+05:30`).toISOString();
    await createFollowUp(supabase, {
      lead_id: parsed.data.leadId,
      due_at: dueAt,
      note: parsed.data.note || null,
      created_by: user.id,
    });
    await logLeadActivity(
      supabase,
      parsed.data.leadId,
      "follow_up",
      `Follow-up scheduled for ${parsed.data.dueDate}`,
      { note: parsed.data.note },
      user.id
    );
    await updateLead(supabase, parsed.data.leadId, { next_follow_up: dueAt });
    revalidatePath(`/leads/${parsed.data.leadId}`);
    revalidatePath("/leads");
    return { ok: true, message: "Follow-up scheduled." };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

export interface LeadSearchHit {
  id: string;
  business_name: string;
  category: string | null;
  area: string | null;
  city: string | null;
  status: LeadRow["status"];
}

/** Powers the Cmd+K palette. */
export async function searchLeadsAction(term: unknown): Promise<LeadSearchHit[]> {
  const parsed = z.string().trim().min(2).max(100).safeParse(term);
  if (!parsed.success) return [];
  try {
    const { supabase } = await requireUser();
    const rows = await searchLeads(supabase, parsed.data);
    return rows.map((lead) => ({
      id: lead.id,
      business_name: lead.business_name,
      category: lead.category,
      area: lead.area,
      city: lead.city,
      status: lead.status,
    }));
  } catch {
    return [];
  }
}
