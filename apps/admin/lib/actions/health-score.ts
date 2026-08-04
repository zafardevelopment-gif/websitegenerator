"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { computeOverallScore, generateWebsiteAudit } from "@aiwebsite/ai";
import { createServerSupabase } from "@aiwebsite/db/server";
import { getAgencyProfile } from "@aiwebsite/db/settings";
import { createHealthScore, getLatestHealthScore, listHealthScores } from "@aiwebsite/db/repositories/health-scores";
import { getLead } from "@aiwebsite/db/repositories/leads";
import { getSite } from "@aiwebsite/db/repositories/sites";
import type { HealthScoreRow, Json } from "@aiwebsite/db/types";

import { buildAiEngine } from "../server/ai-engine";
import { runPageSpeed } from "../server/pagespeed";
import { demoUrl } from "../urls";

export type HealthScoreResult<T = undefined> =
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

const runSchema = z.object({ siteId: z.string().uuid() });

export async function runHealthScoreAction(input: unknown): Promise<HealthScoreResult<HealthScoreRow>> {
  const parsed = runSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  try {
    const { supabase, user } = await requireUser();
    const site = await getSite(supabase, parsed.data.siteId);
    if (!site) return { ok: false, error: "Site not found" };
    if (site.status !== "live") {
      return { ok: false, error: "Publish the site first — Health Score audits the live URL." };
    }
    const lead = await getLead(supabase, site.lead_id);
    if (!lead) return { ok: false, error: "Lead not found" };

    const url = demoUrl(site.slug);
    const pageSpeed = await runPageSpeed(url).catch(() => null);
    if (!pageSpeed) {
      return {
        ok: false,
        error:
          "PageSpeed Insights isn't configured. Add a PAGESPEED_API_KEY in Settings → API Keys.",
      };
    }

    const scores = {
      seo: pageSpeed.mobile.seo,
      performance: pageSpeed.mobile.performance,
      accessibility: pageSpeed.mobile.accessibility,
      bestPractices: pageSpeed.mobile.bestPractices,
      mobile: pageSpeed.mobile.performance,
      desktop: pageSpeed.desktop.performance,
    };

    const { engine } = await buildAiEngine({
      purpose: "website_audit",
      leadId: lead.id,
      siteId: site.id,
      userId: user.id,
    });
    const audit = await generateWebsiteAudit(engine, {
      businessName: lead.business_name,
      category: lead.category,
      scores,
      hasExistingWebsite: lead.website !== null,
    }).catch(() => null);

    const overall = computeOverallScore(scores);

    const saved = await createHealthScore(supabase, {
      site_id: site.id,
      seo_score: scores.seo,
      performance_score: scores.performance,
      accessibility_score: scores.accessibility,
      best_practices_score: scores.bestPractices,
      mobile_score: scores.mobile,
      desktop_score: scores.desktop,
      overall_score: overall,
      ai_audit: (audit ?? {}) as unknown as Json,
      created_by: user.id,
    });

    revalidatePath(`/generator/${site.id}`);
    return { ok: true, message: "Health score updated.", data: saved };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

export async function getLatestHealthScoreAction(siteId: unknown): Promise<HealthScoreRow | null> {
  const parsed = z.string().uuid().safeParse(siteId);
  if (!parsed.success) return null;
  try {
    const { supabase } = await requireUser();
    return await getLatestHealthScore(supabase, parsed.data);
  } catch {
    return null;
  }
}

const pdfSchema = z.object({ siteId: z.string().uuid(), healthScoreId: z.string().uuid() });

export async function generateAuditPdfAction(
  input: unknown
): Promise<HealthScoreResult<{ base64: string; fileName: string }>> {
  const parsed = pdfSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  try {
    const { supabase } = await requireUser();
    const site = await getSite(supabase, parsed.data.siteId);
    if (!site) return { ok: false, error: "Site not found" };
    const lead = await getLead(supabase, site.lead_id);
    if (!lead) return { ok: false, error: "Lead not found" };
    const scores = await listHealthScores(supabase, site.id);
    const score = scores.find((s) => s.id === parsed.data.healthScoreId);
    if (!score) return { ok: false, error: "Health score not found" };

    const agency = await getAgencyProfile(supabase);
    const { auditSchema } = await import("@aiwebsite/ai");
    const auditParse = auditSchema.safeParse(score.ai_audit);
    const audit = auditParse.success
      ? auditParse.data
      : {
          strengths: [],
          weaknesses: [],
          seoRecommendations: [],
          conversionRecommendations: [],
          trustRecommendations: [],
          speedRecommendations: [],
          accessibilityRecommendations: [],
          summary: "",
        };

    const { renderAuditPdf } = await import("../server/audit-pdf");
    const buffer = await renderAuditPdf({
      agency: {
        name: agency.name || "AIVEXA LLP",
        whatsapp: agency.whatsapp,
        email: agency.email,
        address: agency.address,
        gstNo: agency.gst_no,
      },
      businessName: lead.business_name,
      demoUrl: demoUrl(site.slug),
      scores: {
        overall: score.overall_score,
        seo: score.seo_score,
        performance: score.performance_score,
        accessibility: score.accessibility_score,
        bestPractices: score.best_practices_score,
        mobile: score.mobile_score,
        desktop: score.desktop_score,
      },
      audit,
    });

    return {
      ok: true,
      message: "Audit PDF generated.",
      data: {
        base64: buffer.toString("base64"),
        fileName: `${lead.business_name.replace(/[^a-z0-9]+/gi, "-")}-health-audit.pdf`,
      },
    };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}
