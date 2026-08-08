"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  generateSiteContent,
  regenerateSection,
  type TonePreset,
} from "@aiwebsite/ai";
import { isReservedSlug, slugify } from "@aiwebsite/config";
import { createServerSupabase } from "@aiwebsite/db/server";
import { getLead, logLeadActivity, setLeadStatus } from "@aiwebsite/db/repositories/leads";
import { getActivePrompt } from "@aiwebsite/db/repositories/prompt-templates";
import {
  createSite,
  getSite,
  isSlugAvailable,
  updateSite,
} from "@aiwebsite/db/repositories/sites";
import {
  createSiteVersion,
  getSiteVersion,
  setCurrentVersion,
} from "@aiwebsite/db/repositories/site-versions";
import { createMessage } from "@aiwebsite/db/repositories/messages";
import { createTemplate, getTemplateByKey } from "@aiwebsite/db/repositories/templates";
import type { DbClient, Json, LeadRow } from "@aiwebsite/db/types";
import {
  getTemplate,
  parseSiteContent,
  siteContentSchema,
  SITE_SECTION_KEYS,
  type SiteContent,
  type SiteSectionKey,
} from "@aiwebsite/templates";

import { buildAiEngine } from "../server/ai-engine";
import { applyGooglePhotos, fetchAndUploadGooglePhotos } from "../server/google-photo-fill";
import { buildMapUrls, leadToFacts } from "../server/lead-facts";
import { fillContentImages } from "../server/stock-fill";
import {
  getWhatsAppCallbackNumber,
  isWhatsAppCloudConfigured,
  sendWhatsAppTemplate,
  WHATSAPP_TEMPLATES,
} from "../server/whatsapp-cloud";
import { sitesBaseUrl } from "../urls";
import { buildDemoPitchTemplateParams, buildDemoPitchText } from "../whatsapp-pitch";

export type GeneratorResult<T = undefined> =
  | { ok: true; message: string; data?: T }
  | { ok: false; error: string };

const TONES = ["premium", "friendly", "medical-professional", "luxury"] as const;

/** Used when no prompt template exists in the DB (seed not run). */
const FALLBACK_SYSTEM_PROMPT =
  "You are an expert website copywriter for Indian local businesses. Generate complete, conversion-focused website content as strict JSON matching the provided SiteContent schema. Never invent facts not present in the business data; testimonials must be clearly generic samples; keep language simple and trustworthy; reference the locality naturally for local SEO.";

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

async function resolveSystemPrompt(
  db: DbClient,
  category: string | null
): Promise<{ systemPrompt: string; promptTemplateId: string | null }> {
  if (category) {
    const key = `site_content_${category.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}`;
    const categoryPrompt = await getActivePrompt(db, key).catch(() => null);
    if (categoryPrompt) {
      return { systemPrompt: categoryPrompt.system_prompt, promptTemplateId: categoryPrompt.id };
    }
  }
  const fallback = await getActivePrompt(db, "site_content_default").catch(() => null);
  return {
    systemPrompt: fallback?.system_prompt ?? FALLBACK_SYSTEM_PROMPT,
    promptTemplateId: fallback?.id ?? null,
  };
}

async function pickSlug(db: DbClient, businessName: string): Promise<string> {
  const base = slugify(businessName);
  for (let i = 0; i < 100; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    if (!isReservedSlug(candidate) && (await isSlugAvailable(db, candidate))) {
      return candidate;
    }
  }
  return `${base}-${Date.now().toString(36)}`;
}

/** Ensures the registry template has a DB row; returns its id. */
async function ensureTemplateRow(db: DbClient, templateKey: string): Promise<string> {
  const def = getTemplate(templateKey);
  const existing = await getTemplateByKey(db, def.key);
  if (existing) return existing.id;
  const created = await createTemplate(db, {
    key: def.key,
    name: def.name,
    category: def.category,
    description: def.description,
    color_variants: def.colorVariants.map((v) => v.key) as unknown as Json,
    layout_variants: def.layoutVariants.map((v) => v.key) as unknown as Json,
  });
  return created.id;
}

/**
 * Fires the approved `demo_pitch_intro` template on WhatsApp right after a
 * site is generated. No-ops quietly if Cloud API isn't configured, the lead
 * has no phone, or the template isn't approved yet — the caller treats any
 * failure here as non-fatal.
 */
async function autoSendDemoPitch(
  db: DbClient,
  lead: LeadRow,
  siteId: string,
  slug: string,
  userId: string
): Promise<void> {
  const phone = lead.whatsapp ?? lead.phone;
  if (!phone) return;
  if (!(await isWhatsAppCloudConfigured())) return;

  const callNumber = (await getWhatsAppCallbackNumber()) ?? "";
  const demoLink = `${sitesBaseUrl()}/preview/site/${siteId}`;

  const messageId = await sendWhatsAppTemplate({
    to: phone,
    template: WHATSAPP_TEMPLATES.demoPitch,
    bodyParams: buildDemoPitchTemplateParams({
      ownerName: lead.owner_name,
      category: lead.category,
      demoLink,
      callNumber,
    }),
  });

  await createMessage(db, {
    lead_id: lead.id,
    channel: "whatsapp",
    body: buildDemoPitchText({
      ownerName: lead.owner_name,
      category: lead.category,
      demoLink,
      callNumber,
    }),
    status: "sent",
    direction: "outbound",
    external_id: messageId,
    sent_at: new Date().toISOString(),
    created_by: userId,
  });

  await logLeadActivity(
    db,
    lead.id,
    "message_sent",
    "WhatsApp demo pitch auto-sent",
    { channel: "whatsapp", auto: true, site_id: siteId, slug },
    userId
  );

  if (lead.status === "new" || lead.status === "website_generated" || lead.status === "demo_deployed") {
    await setLeadStatus(db, lead.id, "whatsapp_sent");
  }
}

// ── Generate a new website ──────────────────────────────────────────

const generateSchema = z.object({
  leadId: z.string().uuid(),
  templateKey: z.string().min(1).max(50),
  colorVariant: z.string().min(1).max(50),
  layoutVariant: z.string().min(1).max(50),
  tone: z.enum(TONES),
  language: z.enum(["en", "hi", "bilingual"]),
});

export async function generateWebsiteAction(
  input: unknown
): Promise<GeneratorResult<{ siteId: string }>> {
  const parsed = generateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid generation request" };

  let siteId: string | null = null;
  try {
    const { supabase, user } = await requireUser();
    const lead = await getLead(supabase, parsed.data.leadId);
    if (!lead) return { ok: false, error: "Lead not found" };

    const templateId = await ensureTemplateRow(supabase, parsed.data.templateKey);
    const slug = await pickSlug(supabase, lead.business_name);

    const site = await createSite(supabase, {
      lead_id: lead.id,
      template_id: templateId,
      slug,
      name: lead.business_name,
      mode: "demo",
      status: "draft",
      language_mode: parsed.data.language,
      color_variant: parsed.data.colorVariant,
      layout_variant: parsed.data.layoutVariant,
      created_by: user.id,
    });
    siteId = site.id;

    const { systemPrompt, promptTemplateId } = await resolveSystemPrompt(supabase, lead.category);
    const { engine } = await buildAiEngine({
      purpose: "site_content",
      leadId: lead.id,
      siteId: site.id,
      promptTemplateId,
      userId: user.id,
    });
    const facts = leadToFacts(lead);
    const tone = parsed.data.tone as TonePreset;

    const primaryLanguage = parsed.data.language === "hi" ? "hi" : "en";
    const primary = await generateSiteContent(engine, facts, {
      systemPrompt,
      tone,
      language: primaryLanguage,
    });
    // Map links are computed from the lead's real coordinates/place_id, never
    // left to the AI (which correctly leaves unknown location data blank).
    Object.assign(primary.value.business, buildMapUrls(lead));
    // Real Google Business photos first (if the lead has a place_id and
    // Google Places + Cloudinary are configured) — fetched/uploaded once,
    // then applied to every language version. No manual import needed.
    const googlePhotos = await fetchAndUploadGooglePhotos(supabase, lead, user.id).catch(
      () => [] as Awaited<ReturnType<typeof fetchAndUploadGooglePhotos>>
    );
    const withGooglePhotos = applyGooglePhotos(primary.value, googlePhotos);
    // Stock auto-fill: only tops up whatever slots are still empty.
    const filled = await fillContentImages(
      supabase,
      withGooglePhotos.content,
      lead.category
    ).catch(() => ({ content: withGooglePhotos.content, filled: 0 }));
    const summaryParts = [`AI generated (${tone}, ${primaryLanguage})`];
    if (withGooglePhotos.imported > 0) summaryParts.push(`${withGooglePhotos.imported} Google photos`);
    if (filled.filled > 0) summaryParts.push(`${filled.filled} stock images`);
    const version = await createSiteVersion(
      supabase,
      site.id,
      filled.content as unknown as Json,
      summaryParts.join(" + "),
      user.id
    );
    await setCurrentVersion(supabase, site.id, version.id);

    // Bilingual: Hindi saved as a labeled sibling version (switchable in history).
    if (parsed.data.language === "bilingual") {
      const hindi = await generateSiteContent(engine, facts, {
        systemPrompt,
        tone,
        language: "hi",
      });
      Object.assign(hindi.value.business, buildMapUrls(lead));
      const hindiWithPhotos = applyGooglePhotos(hindi.value, googlePhotos);
      await createSiteVersion(
        supabase,
        site.id,
        hindiWithPhotos.content as unknown as Json,
        `AI generated (${tone}, hi)`,
        user.id
      );
      await setCurrentVersion(supabase, site.id, version.id); // English stays primary
    }

    await logLeadActivity(
      supabase,
      lead.id,
      "system",
      `Website generated (${getTemplate(parsed.data.templateKey).name}, ${slug})`,
      { site_id: site.id },
      user.id
    );
    if (lead.status === "new") {
      await setLeadStatus(supabase, lead.id, "website_generated");
    }

    // Auto-send the demo pitch on WhatsApp — best effort: a missing/unapproved
    // Meta template or unconfigured Cloud API must never fail the generation
    // itself, since the site row above is already committed.
    await autoSendDemoPitch(supabase, lead, site.id, slug, user.id).catch((e) => {
      console.error("Auto WhatsApp send failed:", e);
    });

    revalidatePath("/generator");
    revalidatePath(`/leads/${lead.id}`);
    return { ok: true, message: "Website generated.", data: { siteId: site.id } };
  } catch (e) {
    // Roll back the empty site row so retries start clean.
    if (siteId) {
      try {
        const { supabase } = await requireUser();
        await updateSite(supabase, siteId, { deleted_at: new Date().toISOString() });
      } catch {
        // best effort
      }
    }
    return { ok: false, error: friendly(e) };
  }
}

// ── Save a version (manual edits) ───────────────────────────────────

const saveVersionSchema = z.object({
  siteId: z.string().uuid(),
  content: z.unknown(),
  summary: z.string().trim().max(200),
});

export async function saveVersionAction(input: unknown): Promise<GeneratorResult> {
  const parsed = saveVersionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid save request" };

  const content = siteContentSchema.safeParse(parsed.data.content);
  if (!content.success) {
    const issue = content.error.issues[0];
    return {
      ok: false,
      error: `Content invalid — ${issue?.path.join(".") ?? ""}: ${issue?.message ?? "unknown"}`,
    };
  }

  try {
    const { supabase, user } = await requireUser();
    const version = await createSiteVersion(
      supabase,
      parsed.data.siteId,
      content.data as unknown as Json,
      parsed.data.summary || "Manual edit",
      user.id
    );
    revalidatePath(`/generator/${parsed.data.siteId}`);
    return { ok: true, message: `Saved version ${version.version_no}.` };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

// ── Design (variant + branding overrides) ───────────────────────────

const designSchema = z.object({
  siteId: z.string().uuid(),
  colorVariant: z.string().min(1).max(50),
  layoutVariant: z.string().min(1).max(50),
  branding: z.object({
    primary: z.string().regex(/^#[0-9a-fA-F]{6}$/).or(z.literal("")),
    secondary: z.string().regex(/^#[0-9a-fA-F]{6}$/).or(z.literal("")),
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).or(z.literal("")),
    fontHeading: z.string().max(60),
    fontBody: z.string().max(60),
  }),
});

export async function updateSiteDesignAction(input: unknown): Promise<GeneratorResult> {
  const parsed = designSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid design settings" };

  try {
    const { supabase } = await requireUser();
    const overrides: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed.data.branding)) {
      if (value) overrides[key] = value;
    }
    await updateSite(supabase, parsed.data.siteId, {
      color_variant: parsed.data.colorVariant,
      layout_variant: parsed.data.layoutVariant,
      branding: overrides as unknown as Json,
    });
    revalidatePath(`/generator/${parsed.data.siteId}`);
    return { ok: true, message: "Design updated." };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

// ── Section regeneration ────────────────────────────────────────────

const regenerateSchema = z.object({
  siteId: z.string().uuid(),
  sectionKey: z.enum(SITE_SECTION_KEYS as unknown as [SiteSectionKey, ...SiteSectionKey[]]),
  currentSection: z.unknown(),
  instruction: z.string().trim().max(500),
  tone: z.enum(TONES),
});

export async function regenerateSectionAction(
  input: unknown
): Promise<GeneratorResult<{ section: Json }>> {
  const parsed = regenerateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid regeneration request" };

  try {
    const { supabase, user } = await requireUser();
    const site = await getSite(supabase, parsed.data.siteId);
    if (!site) return { ok: false, error: "Site not found" };
    const lead = await getLead(supabase, site.lead_id);
    if (!lead) return { ok: false, error: "Lead not found" };

    const { systemPrompt, promptTemplateId } = await resolveSystemPrompt(supabase, lead.category);
    const { engine } = await buildAiEngine({
      purpose: `section_${parsed.data.sectionKey}`,
      leadId: lead.id,
      siteId: site.id,
      promptTemplateId,
      userId: user.id,
    });

    const language = site.language_mode === "hi" ? "hi" : "en";
    const section = await regenerateSection(
      engine,
      leadToFacts(lead),
      { systemPrompt, tone: parsed.data.tone as TonePreset, language },
      parsed.data.sectionKey,
      parsed.data.currentSection,
      parsed.data.instruction
    );
    return { ok: true, message: "Section regenerated.", data: { section: section as Json } };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

// ── Version rollback ────────────────────────────────────────────────

const restoreSchema = z.object({
  siteId: z.string().uuid(),
  versionId: z.string().uuid(),
});

export async function restoreVersionAction(input: unknown): Promise<GeneratorResult> {
  const parsed = restoreSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid restore request" };
  try {
    const { supabase } = await requireUser();
    const version = await getSiteVersion(supabase, parsed.data.versionId);
    if (!version || version.site_id !== parsed.data.siteId) {
      return { ok: false, error: "Version not found" };
    }
    await setCurrentVersion(supabase, parsed.data.siteId, version.id);
    revalidatePath(`/generator/${parsed.data.siteId}`);
    return { ok: true, message: `Rolled back to version ${version.version_no}.` };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

// ── Clone to another lead ───────────────────────────────────────────

/** Deep-replaces business identity strings in every text field. */
function swapIdentity(content: SiteContent, from: LeadRow, to: LeadRow): SiteContent {
  const replaceText = (value: string): string =>
    from.business_name ? value.split(from.business_name).join(to.business_name) : value;

  const walk = (node: unknown): unknown => {
    if (typeof node === "string") return replaceText(node);
    if (Array.isArray(node)) return node.map(walk);
    if (typeof node === "object" && node !== null) {
      return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, walk(v)]));
    }
    return node;
  };

  const swapped = walk(content) as SiteContent;
  swapped.business = {
    ...swapped.business,
    name: to.business_name,
    category: to.category ?? "",
    phone: to.phone ?? "",
    whatsapp: to.whatsapp ?? to.phone ?? "",
    email: to.email ?? "",
    address: to.address ?? "",
    area: to.area ?? "",
    city: to.city ?? "",
    rating: to.google_rating,
    reviewCount: to.review_count,
    ...buildMapUrls(to),
    socials: {
      instagram: to.instagram ?? "",
      facebook: to.facebook ?? "",
      linkedin: to.linkedin ?? "",
    },
  };
  swapped.gallery = { heading: swapped.gallery.heading, images: [] };
  return swapped;
}

const cloneSchema = z.object({
  siteId: z.string().uuid(),
  targetLeadId: z.string().uuid(),
});

export async function cloneSiteAction(
  input: unknown
): Promise<GeneratorResult<{ newSiteId: string }>> {
  const parsed = cloneSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid clone request" };

  try {
    const { supabase, user } = await requireUser();
    const source = await getSite(supabase, parsed.data.siteId);
    if (!source) return { ok: false, error: "Source site not found" };
    if (!source.current_version_id) return { ok: false, error: "Source site has no content yet" };

    const [sourceLead, targetLead, sourceVersion] = await Promise.all([
      getLead(supabase, source.lead_id),
      getLead(supabase, parsed.data.targetLeadId),
      getSiteVersion(supabase, source.current_version_id),
    ]);
    if (!sourceLead || !targetLead) return { ok: false, error: "Lead not found" };
    if (targetLead.id === sourceLead.id) return { ok: false, error: "Pick a different lead" };
    const content = parseSiteContent(sourceVersion?.site_content);
    if (!content) return { ok: false, error: "Source content is invalid" };

    const slug = await pickSlug(supabase, targetLead.business_name);
    const clone = await createSite(supabase, {
      lead_id: targetLead.id,
      template_id: source.template_id,
      slug,
      name: targetLead.business_name,
      mode: "demo",
      status: "draft",
      language_mode: source.language_mode,
      color_variant: source.color_variant,
      layout_variant: source.layout_variant,
      branding: source.branding,
      created_by: user.id,
    });

    const swapped = swapIdentity(content, sourceLead, targetLead);
    const version = await createSiteVersion(
      supabase,
      clone.id,
      swapped as unknown as Json,
      `Cloned from ${sourceLead.business_name} (${source.slug})`,
      user.id
    );
    await setCurrentVersion(supabase, clone.id, version.id);

    await logLeadActivity(
      supabase,
      targetLead.id,
      "system",
      `Website cloned from ${sourceLead.business_name}`,
      { site_id: clone.id, source_site_id: source.id },
      user.id
    );
    if (targetLead.status === "new") {
      await setLeadStatus(supabase, targetLead.id, "website_generated");
    }

    revalidatePath("/generator");
    return { ok: true, message: "Website cloned.", data: { newSiteId: clone.id } };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}
