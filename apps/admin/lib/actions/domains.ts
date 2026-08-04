"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createServerSupabase } from "@aiwebsite/db/server";
import { getClientByLead } from "@aiwebsite/db/repositories/clients";
import { logLeadActivity } from "@aiwebsite/db/repositories/leads";
import {
  createDomain,
  listDomainsBySite,
  setDomainStatus,
  updateDomain,
} from "@aiwebsite/db/repositories/domains";
import { getSite } from "@aiwebsite/db/repositories/sites";
import type { DomainRow, Json } from "@aiwebsite/db/types";

import {
  addDomainToProject,
  checkDomainVerification,
  isVercelDomainsConfigured,
  removeDomainFromProject,
} from "../server/vercel-domains";
import { revalidateSiteTag } from "../server/renderer";

export type DomainResult<T = undefined> =
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

export async function isDomainConnectConfigured(): Promise<boolean> {
  return isVercelDomainsConfigured();
}

const addSchema = z.object({
  siteId: z.string().uuid(),
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/, "Enter a valid domain"),
});

export async function addDomainAction(input: unknown): Promise<DomainResult<DomainRow>> {
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid domain" };

  if (!isVercelDomainsConfigured()) {
    return {
      ok: false,
      error: "Custom domains aren't configured. Set VERCEL_API_TOKEN and VERCEL_PROJECT_ID_SITES.",
    };
  }

  try {
    const { supabase, user } = await requireUser();
    const site = await getSite(supabase, parsed.data.siteId);
    if (!site) return { ok: false, error: "Site not found" };

    const result = await addDomainToProject(parsed.data.domain);
    const client = await getClientByLead(supabase, site.lead_id);

    const domain = await createDomain(supabase, {
      client_id: client?.id ?? null,
      site_id: site.id,
      domain: parsed.data.domain,
      status: result.verified ? "verifying" : "pending_dns",
      verification: { instructions: result.instructions } as unknown as Json,
    });

    await logLeadActivity(
      supabase,
      site.lead_id,
      "system",
      `Custom domain ${parsed.data.domain} added`,
      { domain_id: domain.id },
      user.id
    );

    revalidatePath(`/generator/${site.id}`);
    revalidatePath("/clients");
    return { ok: true, message: "Domain added — follow the DNS instructions to verify.", data: domain };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

const verifySchema = z.object({ domainId: z.string().uuid(), domain: z.string().min(1), siteId: z.string().uuid() });

export async function verifyDomainAction(
  input: unknown
): Promise<DomainResult<{ verified: boolean }>> {
  const parsed = verifySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  try {
    const { supabase } = await requireUser();
    const result = await checkDomainVerification(parsed.data.domain);

    if (result.verified) {
      await setDomainStatus(supabase, parsed.data.domainId, "active");
      const site = await getSite(supabase, parsed.data.siteId);
      if (site) await revalidateSiteTag(site.slug);
      await revalidateSiteTag(parsed.data.domain);
    } else {
      await updateDomain(supabase, parsed.data.domainId, {
        status: "verifying",
        verification: { instructions: result.instructions } as unknown as Json,
      });
    }

    revalidatePath(`/generator/${parsed.data.siteId}`);
    revalidatePath("/clients");
    return {
      ok: true,
      message: result.verified ? "Domain verified and live." : "Not verified yet — DNS may take time to propagate.",
      data: { verified: result.verified },
    };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

const removeSchema = z.object({ domainId: z.string().uuid(), domain: z.string().min(1) });

export async function removeDomainAction(input: unknown): Promise<DomainResult> {
  const parsed = removeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  try {
    const { supabase } = await requireUser();
    await removeDomainFromProject(parsed.data.domain);
    await setDomainStatus(supabase, parsed.data.domainId, "removed");
    revalidatePath("/clients");
    return { ok: true, message: "Domain removed." };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

export async function listDomainsAction(siteId: unknown): Promise<DomainRow[]> {
  const parsed = z.string().uuid().safeParse(siteId);
  if (!parsed.success) return [];
  try {
    const { supabase } = await requireUser();
    return await listDomainsBySite(supabase, parsed.data);
  } catch {
    return [];
  }
}
