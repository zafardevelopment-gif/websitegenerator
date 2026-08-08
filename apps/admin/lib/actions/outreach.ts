"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { buildOutreachVariables, fillTemplate, personalizeWhatsAppPitch } from "@aiwebsite/ai";
import { createServerSupabase } from "@aiwebsite/db/server";
import { getAgencyProfile } from "@aiwebsite/db/settings";
import { getLead, logLeadActivity, setLeadStatus } from "@aiwebsite/db/repositories/leads";
import {
  getMessageTemplate,
  listMessageTemplates,
} from "@aiwebsite/db/repositories/message-templates";
import { createMessage, listMessagesByLead, updateMessage } from "@aiwebsite/db/repositories/messages";
import { listSites } from "@aiwebsite/db/repositories/sites";
import type { Channel, MessageRow, MessageTemplateRow } from "@aiwebsite/db/types";

import { buildAiEngine } from "../server/ai-engine";
import { leadToFacts } from "../server/lead-facts";
import { getResendClient } from "../server/resend";
import { demoUrl } from "../urls";

export type OutreachResult<T = undefined> =
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

async function primaryDemoUrl(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  leadId: string
): Promise<string | null> {
  const sites = await listSites(supabase, { leadId }, 20);
  const live = sites.find((s) => s.status === "live") ?? sites[0];
  return live ? demoUrl(live.slug) : null;
}

// ── WhatsApp pitch ───────────────────────────────────────────────────

const whatsappDraftSchema = z.object({
  leadId: z.string().uuid(),
  templateKey: z.string().min(1).max(80),
  personalize: z.boolean(),
});

export interface WhatsAppDraft {
  text: string;
  waLink: string;
}

export async function generateWhatsAppDraftAction(
  input: unknown
): Promise<OutreachResult<WhatsAppDraft>> {
  const parsed = whatsappDraftSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  try {
    const { supabase, user } = await requireUser();
    const lead = await getLead(supabase, parsed.data.leadId);
    if (!lead) return { ok: false, error: "Lead not found" };

    const url = await primaryDemoUrl(supabase, lead.id);
    if (!url) return { ok: false, error: "Generate and publish a website for this lead first." };

    const template = await getMessageTemplate(supabase, parsed.data.templateKey);
    if (!template) return { ok: false, error: "Message template not found — run the seed or create one." };

    const vars = buildOutreachVariables(leadToFacts(lead), url);
    const base = fillTemplate(template.body, vars);

    let text = base;
    if (parsed.data.personalize) {
      const { engine } = await buildAiEngine({
        purpose: "whatsapp_pitch",
        leadId: lead.id,
        userId: user.id,
      });
      text = await personalizeWhatsAppPitch(engine, leadToFacts(lead), base);
    }

    const phone = (lead.whatsapp ?? lead.phone ?? "").replace(/[^0-9]/g, "");
    const waLink = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    return { ok: true, message: "Draft ready.", data: { text, waLink } };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

const logWhatsAppSchema = z.object({
  leadId: z.string().uuid(),
  text: z.string().trim().min(1).max(4000),
  templateKey: z.string().max(80).optional(),
});

/** Logs that a WhatsApp message was sent (the actual send happens via wa.me in the browser). */
export async function logWhatsAppSentAction(input: unknown): Promise<OutreachResult> {
  const parsed = logWhatsAppSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  try {
    const { supabase, user } = await requireUser();
    const lead = await getLead(supabase, parsed.data.leadId);
    if (!lead) return { ok: false, error: "Lead not found" };

    let templateId: string | null = null;
    if (parsed.data.templateKey) {
      const template = await getMessageTemplate(supabase, parsed.data.templateKey);
      templateId = template?.id ?? null;
    }

    await createMessage(supabase, {
      lead_id: lead.id,
      channel: "whatsapp",
      template_id: templateId,
      body: parsed.data.text,
      status: "sent",
      sent_at: new Date().toISOString(),
      created_by: user.id,
    });
    await logLeadActivity(
      supabase,
      lead.id,
      "message_sent",
      "WhatsApp pitch sent",
      { channel: "whatsapp" },
      user.id
    );
    if (lead.status === "new" || lead.status === "website_generated" || lead.status === "demo_deployed") {
      await setLeadStatus(supabase, lead.id, "whatsapp_sent");
    }

    revalidatePath(`/leads/${lead.id}`);
    revalidatePath("/outreach");
    revalidatePath("/generator");
    return { ok: true, message: "Logged — status updated to WhatsApp Sent." };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

// ── Send via Meta Cloud API template ────────────────────────────────

const sendTemplateSchema = z.object({
  leadId: z.string().uuid(),
  demoLink: z.string().url(),
});

/**
 * Sends the approved `demo_pitch_intro` template directly via the Meta
 * WhatsApp Cloud API — no WhatsApp web / app needed. Returns an error if the
 * Cloud API credentials haven't been configured in Settings → API Keys.
 */
export async function sendDemoPitchTemplateAction(input: unknown): Promise<OutreachResult> {
  const parsed = sendTemplateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  try {
    const { supabase, user } = await requireUser();
    const lead = await getLead(supabase, parsed.data.leadId);
    if (!lead) return { ok: false, error: "Lead not found" };

    const phone = lead.whatsapp ?? lead.phone;
    if (!phone) return { ok: false, error: "This lead has no WhatsApp / phone number." };

    const {
      isWhatsAppCloudConfigured,
      getWhatsAppCallbackNumber,
      sendWhatsAppTemplate,
      WHATSAPP_TEMPLATES,
    } = await import("../server/whatsapp-cloud");

    if (!(await isWhatsAppCloudConfigured())) {
      return {
        ok: false,
        error:
          "Meta WhatsApp Cloud API is not configured. Add the Phone Number ID and access token in Settings → API Keys.",
      };
    }

    const callNumber = (await getWhatsAppCallbackNumber()) ?? "";
    const { buildDemoPitchTemplateParams, buildDemoPitchText } = await import(
      "../whatsapp-pitch"
    );

    const messageId = await sendWhatsAppTemplate({
      to: phone,
      template: WHATSAPP_TEMPLATES.demoPitch,
      bodyParams: buildDemoPitchTemplateParams({
        ownerName: lead.owner_name,
        category: lead.category,
        demoLink: parsed.data.demoLink,
        callNumber,
      }),
    });

    await createMessage(supabase, {
      lead_id: lead.id,
      channel: "whatsapp",
      body: buildDemoPitchText({
        ownerName: lead.owner_name,
        category: lead.category,
        demoLink: parsed.data.demoLink,
        callNumber,
      }),
      status: "sent",
      direction: "outbound",
      external_id: messageId,
      sent_at: new Date().toISOString(),
      created_by: user.id,
    });

    await logLeadActivity(
      supabase,
      lead.id,
      "message_sent",
      "WhatsApp demo pitch sent via Meta Cloud API",
      { channel: "whatsapp", template: WHATSAPP_TEMPLATES.demoPitch, auto: false },
      user.id
    );

    if (
      lead.status === "new" ||
      lead.status === "website_generated" ||
      lead.status === "demo_deployed"
    ) {
      await setLeadStatus(supabase, lead.id, "whatsapp_sent");
    }

    revalidatePath(`/leads/${lead.id}`);
    revalidatePath("/generator");
    return { ok: true, message: "Template sent via Meta Cloud API ✓" };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

// ── Email ────────────────────────────────────────────────────────────

const emailDraftSchema = z.object({
  leadId: z.string().uuid(),
  templateKey: z.string().min(1).max(80),
});

export interface EmailDraft {
  subject: string;
  body: string;
}

export async function generateEmailDraftAction(input: unknown): Promise<OutreachResult<EmailDraft>> {
  const parsed = emailDraftSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  try {
    const { supabase } = await requireUser();
    const lead = await getLead(supabase, parsed.data.leadId);
    if (!lead) return { ok: false, error: "Lead not found" };
    if (!lead.email) return { ok: false, error: "This lead has no email address." };

    const url = await primaryDemoUrl(supabase, lead.id);
    if (!url) return { ok: false, error: "Generate and publish a website for this lead first." };

    const template = await getMessageTemplate(supabase, parsed.data.templateKey);
    if (!template) return { ok: false, error: "Email template not found." };

    const vars = buildOutreachVariables(leadToFacts(lead), url);
    return {
      ok: true,
      message: "Draft ready.",
      data: {
        subject: fillTemplate(template.subject ?? "A website for {business}", vars),
        body: fillTemplate(template.body, vars),
      },
    };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

const sendEmailSchema = z.object({
  leadId: z.string().uuid(),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10000),
});

export async function sendEmailAction(input: unknown): Promise<OutreachResult> {
  const parsed = sendEmailSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  try {
    const { supabase, user } = await requireUser();
    const lead = await getLead(supabase, parsed.data.leadId);
    if (!lead) return { ok: false, error: "Lead not found" };
    if (!lead.email) return { ok: false, error: "This lead has no email address." };

    const resend = await getResendClient();
    if (!resend) {
      return {
        ok: false,
        error: "Resend isn't configured. Add an API key in Settings → API Keys.",
      };
    }
    const agency = await getAgencyProfile(supabase);
    const fromEmail = agency.email || "hello@aivexallp.com";
    const fromName = agency.name || "AIVEXA";

    const message = await createMessage(supabase, {
      lead_id: lead.id,
      channel: "email",
      subject: parsed.data.subject,
      body: parsed.data.body,
      status: "draft",
      created_by: user.id,
    });

    const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL ?? "http://localhost:3000";
    const pixel = `<img src="${adminUrl}/api/track/email-open/${message.open_token}" width="1" height="1" alt="" style="display:none" />`;
    const htmlBody = parsed.data.body.replace(/\n/g, "<br/>") + pixel;

    try {
      const result = await resend.emails.send({
        from: `${fromName} <${fromEmail}>`,
        to: lead.email,
        subject: parsed.data.subject,
        html: htmlBody,
        text: parsed.data.body,
      });
      if (result.error) {
        await updateMessage(supabase, message.id, { status: "failed", error: result.error.message });
        return { ok: false, error: `Resend error: ${result.error.message}` };
      }
      await updateMessage(supabase, message.id, {
        status: "sent",
        sent_at: new Date().toISOString(),
        external_id: result.data?.id ?? null,
      });
    } catch (e) {
      const errMessage = e instanceof Error ? e.message : "Send failed";
      await updateMessage(supabase, message.id, { status: "failed", error: errMessage });
      return { ok: false, error: errMessage };
    }

    await logLeadActivity(
      supabase,
      lead.id,
      "message_sent",
      `Email sent: ${parsed.data.subject}`,
      { channel: "email" },
      user.id
    );
    revalidatePath(`/leads/${lead.id}`);
    return { ok: true, message: `Email sent to ${lead.email}.` };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

// ── PDF proposal ─────────────────────────────────────────────────────

const proposalSchema = z.object({
  leadId: z.string().uuid(),
  weaknesses: z.array(z.string().max(300)).max(10),
  features: z.array(z.string().max(300)).max(20),
  pricing: z.array(z.object({ description: z.string().max(200), amount: z.number().min(0) })).min(1),
  gstEnabled: z.boolean(),
  gstRate: z.number().min(0).max(100),
});

export async function generateProposalPdfAction(
  input: unknown
): Promise<OutreachResult<{ base64: string; fileName: string }>> {
  const parsed = proposalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid proposal data" };

  try {
    const { supabase } = await requireUser();
    const lead = await getLead(supabase, parsed.data.leadId);
    if (!lead) return { ok: false, error: "Lead not found" };
    const url = (await primaryDemoUrl(supabase, lead.id)) ?? "Not yet published";
    const agency = await getAgencyProfile(supabase);

    const { renderProposalPdf } = await import("../server/proposal-pdf");
    const buffer = await renderProposalPdf({
      agency: {
        name: agency.name || "AIVEXA LLP",
        logoUrl: agency.logo_url,
        whatsapp: agency.whatsapp,
        email: agency.email,
        address: agency.address,
        gstNo: agency.gst_no,
      },
      lead: {
        businessName: lead.business_name,
        ownerName: lead.owner_name,
        category: lead.category,
        website: lead.website,
        googleRating: lead.google_rating,
        reviewCount: lead.review_count,
      },
      demoUrl: url,
      weaknesses: parsed.data.weaknesses,
      features: parsed.data.features,
      pricing: parsed.data.pricing,
      gstEnabled: parsed.data.gstEnabled,
      gstRate: parsed.data.gstRate,
    });

    return {
      ok: true,
      message: "Proposal generated.",
      data: {
        base64: buffer.toString("base64"),
        fileName: `${lead.business_name.replace(/[^a-z0-9]+/gi, "-")}-proposal.pdf`,
      },
    };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

// ── Templates & message history ─────────────────────────────────────

export async function listOutreachTemplatesAction(channel: Channel): Promise<MessageTemplateRow[]> {
  try {
    const { supabase } = await requireUser();
    return await listMessageTemplates(supabase, channel);
  } catch {
    return [];
  }
}

export async function listLeadMessagesAction(leadId: unknown): Promise<MessageRow[]> {
  const parsed = z.string().uuid().safeParse(leadId);
  if (!parsed.success) return [];
  try {
    const { supabase } = await requireUser();
    return await listMessagesByLead(supabase, parsed.data);
  } catch {
    return [];
  }
}
