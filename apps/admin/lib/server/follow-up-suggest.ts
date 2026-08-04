import "server-only";

import { hasActiveFollowUp, createFollowUp } from "@aiwebsite/db/repositories/follow-ups";
import type { DbClient, LeadStatus } from "@aiwebsite/db/types";

/**
 * Days after a status change that a follow-up should naturally happen.
 * Statuses not listed here don't get an auto-suggestion (e.g. terminal
 * states, or ones where the next action isn't time-based).
 */
const SUGGEST_OFFSET_DAYS: Partial<Record<LeadStatus, number>> = {
  demo_deployed: 1,
  whatsapp_sent: 2,
  demo_viewed: 1,
  waiting: 3,
  interested: 1,
  meeting: 2,
  quotation_sent: 3,
  negotiation: 2,
};

const SUGGEST_NOTE: Partial<Record<LeadStatus, string>> = {
  demo_deployed: "Check if the demo was viewed; nudge if not.",
  whatsapp_sent: "Follow up if no reply to the WhatsApp pitch.",
  demo_viewed: "Call — they viewed the demo, strike while interested.",
  waiting: "Check back in — see if they've made a decision.",
  interested: "Set up a meeting or call to discuss next steps.",
  meeting: "Confirm meeting outcome and next action.",
  quotation_sent: "Check if the quotation was reviewed.",
  negotiation: "Follow up on negotiation terms.",
};

/**
 * Auto-suggests the next follow-up when a lead's status changes — unless
 * one is already pending/snoozed for this lead (never double-schedule).
 */
export async function autoSuggestFollowUp(
  db: DbClient,
  leadId: string,
  newStatus: LeadStatus,
  actorId: string | null
): Promise<void> {
  const offsetDays = SUGGEST_OFFSET_DAYS[newStatus];
  if (offsetDays === undefined) return;
  if (await hasActiveFollowUp(db, leadId)) return;

  const dueAt = new Date(Date.now() + offsetDays * 86400_000);
  dueAt.setHours(10, 0, 0, 0); // 10 AM local-ish default slot

  await createFollowUp(db, {
    lead_id: leadId,
    due_at: dueAt.toISOString(),
    note: SUGGEST_NOTE[newStatus] ?? null,
    created_by: actorId,
  });
}
