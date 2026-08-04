"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createServerSupabase } from "@aiwebsite/db/server";
import { getAgencyProfile } from "@aiwebsite/db/settings";
import { createClient, getClientByLead, listClients, updateClient } from "@aiwebsite/db/repositories/clients";
import { listDomainsBySite } from "@aiwebsite/db/repositories/domains";
import { getLead, logLeadActivity, setLeadStatus } from "@aiwebsite/db/repositories/leads";
import { getSite, listSites, updateSite } from "@aiwebsite/db/repositories/sites";
import type { ClientRow } from "@aiwebsite/db/types";

import { revalidateSiteTag } from "../server/renderer";
import { demoUrl } from "../urls";

// Keep in sync with REQUIREMENTS_CHECKLIST_ITEMS keys in "../constants/clients".
// Duplicated locally (rather than imported) because a "use server" file can only
// export async functions — importing a shared const that a client component also
// imports directly causes Next's flight compiler to mis-register it as an action export.
const REQUIREMENTS_CHECKLIST_KEYS = [
  "logo_received",
  "content_confirmed",
  "domain_decided",
  "payment_received",
  "google_business_shared",
] as const;

export type ClientResult<T = undefined> =
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

// ── Convert demo → permanent client ─────────────────────────────────

const convertSchema = z.object({
  leadId: z.string().uuid(),
  siteId: z.string().uuid(),
});

/** Won flow: demo → permanent project. Creates the client record and flips
 *  the site to production mode (removes demo banner, enables indexing) —
 *  atomically from the caller's perspective (no partial state on error). */
export async function convertLeadToClientAction(
  input: unknown
): Promise<ClientResult<ClientRow>> {
  const parsed = convertSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  try {
    const { supabase, user } = await requireUser();
    const lead = await getLead(supabase, parsed.data.leadId);
    if (!lead) return { ok: false, error: "Lead not found" };

    const sites = await listSites(supabase, { leadId: lead.id }, 20);
    const site = sites.find((s) => s.id === parsed.data.siteId);
    if (!site) return { ok: false, error: "Site not found" };
    if (site.status !== "live") {
      return { ok: false, error: "Publish the site before converting it to a permanent project." };
    }

    const existing = await getClientByLead(supabase, lead.id);
    if (existing) return { ok: false, error: "This lead is already converted to a client." };

    const client = await createClient(supabase, {
      lead_id: lead.id,
      site_id: site.id,
      business_name: lead.business_name,
      onboarding_checklist: Object.fromEntries(
        REQUIREMENTS_CHECKLIST_KEYS.map((key) => [key, false])
      ),
      is_active: true,
    });

    await updateSite(supabase, site.id, {
      status: "converted",
      mode: "production",
      noindex: false,
      converted_at: new Date().toISOString(),
      demo_expires_at: null,
    });
    await revalidateSiteTag(site.slug);

    await setLeadStatus(supabase, lead.id, "won");
    await logLeadActivity(
      supabase,
      lead.id,
      "system",
      `Converted to permanent client project (${site.slug})`,
      { client_id: client.id, site_id: site.id },
      user.id
    );

    revalidatePath(`/leads/${lead.id}`);
    revalidatePath("/clients");
    revalidatePath(`/generator/${site.id}`);
    return { ok: true, message: "Converted to a permanent client project.", data: client };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

export async function getClientByLeadAction(leadId: unknown): Promise<ClientRow | null> {
  const parsed = z.string().uuid().safeParse(leadId);
  if (!parsed.success) return null;
  try {
    const { supabase } = await requireUser();
    return await getClientByLead(supabase, parsed.data);
  } catch {
    return null;
  }
}

export async function listClientsAction(): Promise<ClientRow[]> {
  try {
    const { supabase } = await requireUser();
    return await listClients(supabase);
  } catch {
    return [];
  }
}

// ── Requirements checklist ───────────────────────────────────────────

const checklistSchema = z.object({
  clientId: z.string().uuid(),
  key: z.string().min(1).max(80),
  checked: z.boolean(),
});

export async function setChecklistItemAction(input: unknown): Promise<ClientResult> {
  const parsed = checklistSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  try {
    const { supabase } = await requireUser();
    const clients = await listClients(supabase);
    const client = clients.find((c) => c.id === parsed.data.clientId);
    if (!client) return { ok: false, error: "Client not found" };

    const checklist =
      typeof client.onboarding_checklist === "object" && client.onboarding_checklist !== null
        ? { ...(client.onboarding_checklist as Record<string, boolean>) }
        : {};
    checklist[parsed.data.key] = parsed.data.checked;

    await updateClient(supabase, client.id, { onboarding_checklist: checklist });
    revalidatePath("/clients");
    return { ok: true, message: "Checklist updated." };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

// ── Handover pack (Phase 7) ──────────────────────────────────────────

const handoverSchema = z.object({ clientId: z.string().uuid() });

export async function generateHandoverPackAction(
  input: unknown
): Promise<ClientResult<{ base64: string; fileName: string }>> {
  const parsed = handoverSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  try {
    const { supabase } = await requireUser();
    const clients = await listClients(supabase);
    const client = clients.find((c) => c.id === parsed.data.clientId);
    if (!client) return { ok: false, error: "Client not found" };
    if (!client.site_id) return { ok: false, error: "This client has no linked site." };

    const site = await getSite(supabase, client.site_id);
    if (!site) return { ok: false, error: "Site not found" };

    const domains = await listDomainsBySite(supabase, site.id);
    const activeDomain = domains.find((d) => d.status === "active");
    const agency = await getAgencyProfile(supabase);

    const { renderHandoverPdf } = await import("../server/handover-pdf");
    const buffer = await renderHandoverPdf({
      agency: {
        name: agency.name || "AIVEXA LLP",
        whatsapp: agency.whatsapp,
        email: agency.email,
        address: agency.address,
        gstNo: agency.gst_no,
      },
      businessName: client.business_name,
      liveUrl: activeDomain ? `https://${activeDomain.domain}` : demoUrl(site.slug),
      domainStatus: activeDomain ? "custom" : "demo_subdomain",
      domainExpiry: client.domain_expiry,
      renewalDate: client.renewal_date,
      hostingNotes: client.hosting_notes,
      maintenanceNotes: client.maintenance_notes,
      convertedAt: site.converted_at,
    });

    return {
      ok: true,
      message: "Handover pack generated.",
      data: {
        base64: buffer.toString("base64"),
        fileName: `${client.business_name.replace(/[^a-z0-9]+/gi, "-")}-handover-pack.pdf`,
      },
    };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

// ── Client record (renewals, notes) ──────────────────────────────────

const recordSchema = z.object({
  clientId: z.string().uuid(),
  domainExpiry: z.string().trim().nullable().optional(),
  renewalDate: z.string().trim().nullable().optional(),
  maintenanceNotes: z.string().trim().max(4000).nullable().optional(),
  hostingNotes: z.string().trim().max(4000).nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function updateClientRecordAction(input: unknown): Promise<ClientResult> {
  const parsed = recordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  try {
    const { supabase } = await requireUser();
    await updateClient(supabase, parsed.data.clientId, {
      domain_expiry: parsed.data.domainExpiry || null,
      renewal_date: parsed.data.renewalDate || null,
      maintenance_notes: parsed.data.maintenanceNotes ?? null,
      hosting_notes: parsed.data.hostingNotes ?? null,
      ...(parsed.data.isActive !== undefined ? { is_active: parsed.data.isActive } : {}),
    });
    revalidatePath("/clients");
    return { ok: true, message: "Client record updated." };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}
