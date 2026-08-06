import type { LeadStatus, Priority } from "@aiwebsite/db/types";

/** Pipeline order — drives selects, Kanban columns (Phase 4) and funnel. */
export const LEAD_STATUSES: LeadStatus[] = [
  "new",
  "website_generated",
  "demo_deployed",
  "whatsapp_sent",
  "demo_viewed",
  "waiting",
  "interested",
  "meeting",
  "quotation_sent",
  "negotiation",
  "won",
  "lost",
];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  website_generated: "Website Generated",
  demo_deployed: "Demo Deployed",
  whatsapp_sent: "WhatsApp Sent",
  demo_viewed: "Demo Viewed",
  waiting: "Waiting",
  interested: "Interested",
  meeting: "Meeting",
  quotation_sent: "Quotation Sent",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

/** Tailwind classes per status for badges (light + dark aware). */
export const LEAD_STATUS_CLASSES: Record<LeadStatus, string> = {
  new: "bg-secondary text-secondary-foreground",
  website_generated: "bg-chart-2/15 text-chart-2 border border-chart-2/30",
  demo_deployed: "bg-primary/10 text-primary border border-primary/30",
  whatsapp_sent: "bg-success/10 text-success border border-success/30",
  demo_viewed: "bg-warning/15 text-warning-foreground border border-warning/40 dark:text-warning",
  waiting: "bg-muted text-muted-foreground",
  interested: "bg-warning/20 text-warning-foreground border border-warning/40 dark:text-warning",
  meeting: "bg-chart-4/15 text-foreground border border-chart-4/40",
  quotation_sent: "bg-chart-3/15 text-foreground border border-chart-3/40",
  negotiation: "bg-destructive/10 text-destructive border border-destructive/30",
  won: "bg-success text-success-foreground",
  lost: "bg-destructive/80 text-destructive-foreground",
};

export const PRIORITIES: Priority[] = ["high", "medium", "low"];

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const PRIORITY_CLASSES: Record<Priority, string> = {
  high: "bg-destructive/10 text-destructive border border-destructive/30",
  medium: "bg-warning/15 text-warning-foreground border border-warning/40 dark:text-warning",
  low: "bg-muted text-muted-foreground",
};

/** Builds a wa.me deep link from a raw phone/WhatsApp number, optionally prefilled. */
export function waLink(phone: string, text?: string): string {
  const base = `https://wa.me/${phone.replace(/[^0-9]/g, "")}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
