"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { isReservedSlug, normalizeDeployConfig, SETTING_KEYS } from "@aiwebsite/config";
import { createServerSupabase } from "@aiwebsite/db/server";
import { getJsonSetting } from "@aiwebsite/db/settings";
import {
  completeDeployment,
  listDeployments,
  startDeployment,
} from "@aiwebsite/db/repositories/deployments";
import { getLead, logLeadActivity, setLeadStatus } from "@aiwebsite/db/repositories/leads";
import { getSite, isSlugAvailable, updateSite } from "@aiwebsite/db/repositories/sites";
import {
  claimDemoSlot,
  getSlotForSite,
  NoFreeSlotError,
  releaseSlotForSite,
  syncSlotExpiry,
} from "@aiwebsite/db/repositories/demo-slots";
import type { DbClient, DeployAction, DeploymentRow, SiteRow, SiteStatus } from "@aiwebsite/db/types";

import { revalidateSiteTag } from "../server/renderer";

export type DeployResult<T = undefined> =
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

/** Shared status-change pipeline with full audit logging. */
async function transition(
  siteId: unknown,
  action: DeployAction,
  toStatus: SiteStatus,
  extraPatch: Record<string, unknown> = {},
  options: { requireVersion?: boolean; leadActivity?: string } = {}
): Promise<DeployResult<{ slug: string }>> {
  const parsed = z.string().uuid().safeParse(siteId);
  if (!parsed.success) return { ok: false, error: "Invalid site id" };

  try {
    const { supabase, user } = await requireUser();
    const site = await getSite(supabase, parsed.data);
    if (!site || site.deleted_at) return { ok: false, error: "Site not found" };
    if (options.requireVersion && !site.current_version_id) {
      return { ok: false, error: "Generate content before publishing." };
    }

    const deployment = await startDeployment(supabase, site.id, action, user.id);
    await updateSite(supabase, site.id, { status: toStatus, ...extraPatch });
    const revalidated = await revalidateSiteTag(site.slug);
    await completeDeployment(
      supabase,
      deployment.id,
      "success",
      `${action} → ${toStatus}`,
      [{ at: new Date().toISOString(), detail: revalidated.detail }]
    );

    if (options.leadActivity) {
      await logLeadActivity(
        supabase,
        site.lead_id,
        "system",
        options.leadActivity,
        { site_id: site.id, slug: site.slug },
        user.id
      );
    }

    revalidatePath("/deployments");
    revalidatePath(`/generator/${site.id}`);
    return { ok: true, message: `${action} complete.`, data: { slug: site.slug } };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}


// ── Demo slot lifecycle ─────────────────────────────────────────────

/**
 * Return a site's demo slot to the pool.
 *
 * The site keeps a row in `aiwebsite_sites` with a unique slug, so before
 * the slug can be re-leased we retire the old site's copy of it — otherwise
 * the next lease would collide on `aiwebsite_sites.slug`. The retired form
 * (`demo3-x7f2a1`) keeps deployment history readable and never resolves in
 * the renderer, which is what we want for a demo that's been handed back.
 */
async function releaseSiteSlot(
  db: DbClient,
  site: SiteRow,
  note: string
): Promise<string | null> {
  const slot = await getSlotForSite(db, site.id);
  if (!slot) return null;

  if (site.slug === slot.slug) {
    const suffix = site.id.replace(/-/g, "").slice(0, 6);
    await updateSite(db, site.id, { slug: `${slot.slug}-${suffix}` });
  }
  await releaseSlotForSite(db, site.id, { note });
  await revalidateSiteTag(slot.slug);
  return slot.slug;
}

/** Manual release from the slots view or a lead's site panel. */
export async function releaseSiteSlotAction(
  siteId: unknown,
  note?: string
): Promise<DeployResult<{ slug: string | null }>> {
  const parsed = z.string().uuid().safeParse(siteId);
  if (!parsed.success) return { ok: false, error: "Invalid site id" };
  try {
    const { supabase, user } = await requireUser();
    const site = await getSite(supabase, parsed.data);
    if (!site) return { ok: false, error: "Site not found" };

    const released = await releaseSiteSlot(supabase, site, note ?? "released manually");
    if (!released) return { ok: true, message: "This site holds no slot.", data: { slug: null } };

    await updateSite(supabase, site.id, { status: "archived", archived_at: new Date().toISOString() });
    await logLeadActivity(
      supabase,
      site.lead_id,
      "system",
      `Demo slot ${released} returned to the pool`,
      { site_id: site.id, slug: released },
      user.id
    );
    revalidatePath("/deployments");
    revalidatePath("/settings/slots");
    return { ok: true, message: `${released} returned to the pool.`, data: { slug: released } };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

// ── Publish / republish ─────────────────────────────────────────────

export async function publishSiteAction(
  siteId: unknown
): Promise<DeployResult<{ slug: string; expiresAt: string }>> {
  const parsed = z.string().uuid().safeParse(siteId);
  if (!parsed.success) return { ok: false, error: "Invalid site id" };

  try {
    const { supabase, user } = await requireUser();
    const site = await getSite(supabase, parsed.data);
    if (!site || site.deleted_at) return { ok: false, error: "Site not found" };
    if (!site.current_version_id) {
      return { ok: false, error: "Generate and save content before publishing." };
    }

    const config = normalizeDeployConfig(
      await getJsonSetting(supabase, SETTING_KEYS.deployConfig)
    );
    const expiresAt =
      site.mode === "demo"
        ? new Date(Date.now() + config.demoExpiryDays * 86400_000).toISOString()
        : null;

    const deployment = await startDeployment(supabase, site.id, "publish", user.id);

    // Demos live on a leased pool subdomain (demo1 … demoN); production
    // sites keep the slug they were given. Claim is idempotent, so a retried
    // publish refreshes the existing lease instead of eating another slot.
    let slug = site.slug;
    if (site.mode === "demo") {
      try {
        const slot = await claimDemoSlot(supabase, {
          siteId: site.id,
          leadId: site.lead_id,
          expiresAt,
        });
        slug = slot.slug;
      } catch (e) {
        if (e instanceof NoFreeSlotError) {
          await completeDeployment(supabase, deployment.id, "failed", e.message, []);
          return { ok: false, error: e.message };
        }
        throw e;
      }
    }

    const previousSlug = site.slug;
    await updateSite(supabase, site.id, {
      slug,
      status: "live",
      published_at: new Date().toISOString(),
      demo_expires_at: expiresAt,
      archived_at: null,
    });
    if (previousSlug !== slug) await revalidateSiteTag(previousSlug);
    const revalidated = await revalidateSiteTag(slug);
    await completeDeployment(supabase, deployment.id, "success", "published", [
      { at: new Date().toISOString(), detail: revalidated.detail },
      { at: new Date().toISOString(), detail: `slot ${slug}` },
      { at: new Date().toISOString(), detail: `expires ${expiresAt ?? "never"}` },
    ]);

    await logLeadActivity(
      supabase,
      site.lead_id,
      "system",
      `Demo published at ${slug}`,
      { site_id: site.id, slug },
      user.id
    );
    const lead = await getLead(supabase, site.lead_id);
    if (lead && (lead.status === "new" || lead.status === "website_generated")) {
      await setLeadStatus(supabase, lead.id, "demo_deployed");
    }

    revalidatePath("/deployments");
    revalidatePath("/settings/slots");
    revalidatePath(`/generator/${site.id}`);
    return {
      ok: true,
      message: "Demo is live.",
      data: { slug, expiresAt: expiresAt ?? "" },
    };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

// ── Lifecycle actions ───────────────────────────────────────────────

export async function refreshSiteAction(siteId: unknown): Promise<DeployResult<{ slug: string }>> {
  return transition(siteId, "refresh", "live", {}, { requireVersion: true });
}

export async function pauseSiteAction(siteId: unknown): Promise<DeployResult<{ slug: string }>> {
  return transition(siteId, "pause", "paused", {}, { leadActivity: "Demo paused" });
}

export async function resumeSiteAction(siteId: unknown): Promise<DeployResult<{ slug: string }>> {
  return transition(
    siteId,
    "resume",
    "live",
    {},
    { requireVersion: true, leadActivity: "Demo resumed" }
  );
}

export async function unpublishSiteAction(siteId: unknown): Promise<DeployResult<{ slug: string }>> {
  return transition(siteId, "unpublish", "draft", { published_at: null });
}

export async function archiveSiteAction(siteId: unknown): Promise<DeployResult<{ slug: string }>> {
  const parsed = z.string().uuid().safeParse(siteId);
  if (!parsed.success) return { ok: false, error: "Invalid site id" };
  try {
    const { supabase } = await requireUser();
    const site = await getSite(supabase, parsed.data);
    // Archiving ends the pitch, so the subdomain goes back into rotation.
    if (site && !site.deleted_at) await releaseSiteSlot(supabase, site, "site archived");
  } catch {
    // A failed release must not block the archive itself; the nightly
    // sweep reconciles orphaned slots.
  }
  const result = await transition(
    siteId,
    "archive",
    "archived",
    { archived_at: new Date().toISOString() },
    { leadActivity: "Demo archived" }
  );
  revalidatePath("/settings/slots");
  return result;
}

export async function deleteSiteDeployAction(siteId: unknown): Promise<DeployResult> {
  const parsed = z.string().uuid().safeParse(siteId);
  if (!parsed.success) return { ok: false, error: "Invalid site id" };
  try {
    const { supabase, user } = await requireUser();
    const site = await getSite(supabase, parsed.data);
    if (!site) return { ok: false, error: "Site not found" };

    const deployment = await startDeployment(supabase, site.id, "unpublish", user.id);
    await releaseSiteSlot(supabase, site, "site deleted");
    await updateSite(supabase, site.id, {
      deleted_at: new Date().toISOString(),
      status: "archived",
    });
    const revalidated = await revalidateSiteTag(site.slug);
    await completeDeployment(supabase, deployment.id, "success", "soft-deleted", [
      { at: new Date().toISOString(), detail: revalidated.detail },
    ]);
    revalidatePath("/deployments");
    revalidatePath("/settings/slots");
    return { ok: true, message: "Site deleted (soft) — restorable from the database." };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

// ── Slug management ─────────────────────────────────────────────────

const slugSchema = z.object({
  siteId: z.string().uuid(),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, "Lowercase letters, digits and hyphens only")
    .min(3, "At least 3 characters")
    .max(63),
});

export async function updateSlugAction(
  input: unknown
): Promise<DeployResult<{ slug: string }>> {
  const parsed = slugSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid slug" };
  }
  if (isReservedSlug(parsed.data.slug)) {
    return { ok: false, error: `"${parsed.data.slug}" is a reserved subdomain.` };
  }

  try {
    const { supabase, user } = await requireUser();
    const site = await getSite(supabase, parsed.data.siteId);
    if (!site) return { ok: false, error: "Site not found" };
    if (site.slug === parsed.data.slug) return { ok: true, message: "Slug unchanged.", data: { slug: site.slug } };
    if (site.mode === "demo" && (await getSlotForSite(supabase, site.id))) {
      return {
        ok: false,
        error:
          "This demo is on a pooled subdomain. Release the slot first, or switch the site to production mode.",
      };
    }
    if (!(await isSlugAvailable(supabase, parsed.data.slug))) {
      return { ok: false, error: `"${parsed.data.slug}" is already taken.` };
    }

    const oldSlug = site.slug;
    const deployment = await startDeployment(supabase, site.id, "refresh", user.id);
    await updateSite(supabase, site.id, { slug: parsed.data.slug });
    const oldResult = await revalidateSiteTag(oldSlug);
    const newResult = await revalidateSiteTag(parsed.data.slug);
    await completeDeployment(supabase, deployment.id, "success", `slug ${oldSlug} → ${parsed.data.slug}`, [
      { at: new Date().toISOString(), detail: `old: ${oldResult.detail}` },
      { at: new Date().toISOString(), detail: `new: ${newResult.detail}` },
    ]);

    revalidatePath("/deployments");
    revalidatePath(`/generator/${site.id}`);
    return { ok: true, message: "Slug updated.", data: { slug: parsed.data.slug } };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

// ── Expiry ──────────────────────────────────────────────────────────

/**
 * Push a live demo's expiry out. Kept in one place because the slot mirrors
 * `demo_expires_at` — the nightly sweep reads the slot, not the site.
 */
export async function extendDemoExpiryAction(
  siteId: unknown,
  days = 7
): Promise<DeployResult<{ expiresAt: string }>> {
  const parsed = z.string().uuid().safeParse(siteId);
  if (!parsed.success) return { ok: false, error: "Invalid site id" };
  if (!Number.isInteger(days) || days < 1 || days > 90) {
    return { ok: false, error: "Extend by 1–90 days." };
  }
  try {
    const { supabase, user } = await requireUser();
    const site = await getSite(supabase, parsed.data);
    if (!site || site.deleted_at) return { ok: false, error: "Site not found" };

    const base = site.demo_expires_at ? new Date(site.demo_expires_at) : new Date();
    const from = base.getTime() > Date.now() ? base : new Date();
    const expiresAt = new Date(from.getTime() + days * 86400_000).toISOString();

    await updateSite(supabase, site.id, { demo_expires_at: expiresAt });
    await syncSlotExpiry(supabase, site.id, expiresAt);
    await logLeadActivity(
      supabase,
      site.lead_id,
      "system",
      `Demo expiry extended by ${days} day${days === 1 ? "" : "s"}`,
      { site_id: site.id, expires_at: expiresAt },
      user.id
    );

    revalidatePath("/deployments");
    revalidatePath("/settings/slots");
    revalidatePath(`/generator/${site.id}`);
    return { ok: true, message: `Extended by ${days} days.`, data: { expiresAt } };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

// ── Logs ────────────────────────────────────────────────────────────

export async function listDeploymentsAction(siteId: unknown): Promise<DeploymentRow[]> {
  const parsed = z.string().uuid().safeParse(siteId);
  if (!parsed.success) return [];
  try {
    const { supabase } = await requireUser();
    return await listDeployments(supabase, parsed.data, 30);
  } catch {
    return [];
  }
}

// ── Deploy settings ─────────────────────────────────────────────────

const deployConfigSchema = z.object({
  demoExpiryDays: z.number().int().min(1).max(365),
});

export async function saveDeployConfigAction(input: unknown): Promise<DeployResult> {
  const parsed = deployConfigSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Expiry must be 1–365 days" };
  try {
    const { supabase, user } = await requireUser();
    const { saveJsonSetting } = await import("@aiwebsite/db/settings");
    await saveJsonSetting(supabase, SETTING_KEYS.deployConfig, parsed.data, user.id);
    revalidatePath("/settings");
    return { ok: true, message: "Deployment settings saved." };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}
