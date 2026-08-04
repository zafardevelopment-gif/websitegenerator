import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  CalendarClock,
  CreditCard,
  Eye,
  FileText,
  Globe,
  Import,
  Inbox,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  StickyNote,
  Users,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { createServerSupabase } from "@aiwebsite/db/server";
import { getClientByLead } from "@aiwebsite/db/repositories/clients";
import { getLead, listLeadActivities } from "@aiwebsite/db/repositories/leads";
import { listFollowUpsByLead } from "@aiwebsite/db/repositories/follow-ups";
import { listMessageTemplates } from "@aiwebsite/db/repositories/message-templates";
import { listMessagesByLead } from "@aiwebsite/db/repositories/messages";
import { listQuotationsByLead } from "@aiwebsite/db/repositories/quotations";
import { listSites } from "@aiwebsite/db/repositories/sites";
import { getSiteEngagement, type SiteEngagementSummary } from "@aiwebsite/db/repositories/tracking";
import type { ActivityType } from "@aiwebsite/db/types";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Separator,
} from "@aiwebsite/ui";

import { LeadStatusBadge, PriorityBadge, RatingCell } from "@/components/lead-badges";
import { formatDate, formatDateTime, formatRelative } from "@/lib/format";

import { ConvertToClientCard } from "./convert-to-client-card";
import { LeadHeaderActions } from "./lead-header-actions";
import { NoteForm } from "./note-form";
import { OutreachPanel } from "./outreach-panel";
import { QuotationsPanel } from "./quotations-panel";

export const metadata: Metadata = {
  title: "Lead",
};

const ACTIVITY_ICONS: Record<ActivityType, LucideIcon> = {
  status_change: Workflow,
  note: StickyNote,
  message_sent: MessageSquare,
  message_received: Inbox,
  demo_view: Zap,
  follow_up: CalendarClock,
  import: Import,
  call: Phone,
  meeting: Users,
  quotation: FileText,
  payment: CreditCard,
  system: Globe,
};

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right font-medium [overflow-wrap:anywhere]">{value}</span>
    </div>
  );
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const lead = await getLead(supabase, id);
  if (!lead) notFound();

  const [activities, followUps, whatsappTemplates, emailTemplates, messages, quotations, sites, client] =
    await Promise.all([
      listLeadActivities(supabase, id),
      listFollowUpsByLead(supabase, id),
      listMessageTemplates(supabase, "whatsapp"),
      listMessageTemplates(supabase, "email"),
      listMessagesByLead(supabase, id),
      listQuotationsByLead(supabase, id),
      listSites(supabase, { leadId: id }, 20),
      getClientByLead(supabase, id),
    ]);
  const pendingFollowUps = followUps.filter((f) => f.status === "pending" || f.status === "snoozed");
  const services = Array.isArray(lead.services) ? (lead.services as string[]) : [];

  // Engagement card reads off whichever site is currently fronting this
  // lead — live/converted first, else the most recent draft.
  const primarySite = sites.find((s) => s.status === "live" || s.status === "converted") ?? sites[0] ?? null;
  const engagement: SiteEngagementSummary | null = primarySite
    ? await getSiteEngagement(supabase, primarySite.id)
    : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <Link
          href="/leads"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to leads
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">{lead.business_name}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <LeadStatusBadge status={lead.status} />
              <PriorityBadge priority={lead.priority} />
              <Badge variant="outline">Score {lead.lead_score}</Badge>
              {lead.category && <Badge variant="secondary">{lead.category}</Badge>}
              {lead.deleted_at && <Badge variant="destructive">In trash</Badge>}
              {lead.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-muted-foreground">
                  #{tag}
                </Badge>
              ))}
            </div>
          </div>
          <LeadHeaderActions lead={lead} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left: info */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Phone className="h-4 w-4 text-muted-foreground" />
                Contact
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              <InfoRow label="Owner" value={lead.owner_name ?? "—"} />
              <InfoRow
                label="Phone"
                value={
                  lead.phone ? (
                    <a href={`tel:${lead.phone}`} className="text-primary hover:underline">
                      {lead.phone}
                    </a>
                  ) : (
                    "—"
                  )
                }
              />
              <InfoRow label="WhatsApp" value={lead.whatsapp ?? "—"} />
              <InfoRow
                label="Email"
                value={
                  lead.email ? (
                    <a href={`mailto:${lead.email}`} className="text-primary hover:underline">
                      {lead.email}
                    </a>
                  ) : (
                    "—"
                  )
                }
              />
              <InfoRow
                label="Website"
                value={
                  lead.website ? (
                    <a
                      href={lead.website}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline"
                    >
                      {lead.website.replace(/^https?:\/\//, "")}
                    </a>
                  ) : (
                    <span className="text-success">None — opportunity ✨</span>
                  )
                }
              />
              <InfoRow label="Instagram" value={lead.instagram ?? "—"} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                Business
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              <InfoRow
                label="Google rating"
                value={<RatingCell rating={lead.google_rating} reviews={lead.review_count} />}
              />
              <InfoRow
                label="Address"
                value={
                  [lead.address, lead.area, lead.city, lead.state, lead.pincode]
                    .filter(Boolean)
                    .join(", ") || "—"
                }
              />
              <InfoRow
                label="Maps"
                value={
                  lead.google_maps_url ? (
                    <a
                      href={lead.google_maps_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline"
                    >
                      Open in Google Maps
                    </a>
                  ) : (
                    "—"
                  )
                }
              />
              <InfoRow
                label="Services"
                value={services.length > 0 ? services.join(", ") : "—"}
              />
              <InfoRow label="Source" value={lead.lead_source ?? "—"} />
              <InfoRow label="Created" value={formatDate(lead.created_at)} />
              <InfoRow label="Last contacted" value={formatDate(lead.last_contacted_at)} />
            </CardContent>
          </Card>

          {lead.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <StickyNote className="h-4 w-4 text-muted-foreground" />
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm">{lead.notes}</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                Follow-ups
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingFollowUps.length === 0 && (
                <p className="text-sm text-muted-foreground">No pending follow-ups.</p>
              )}
              {pendingFollowUps.map((f) => {
                const overdue = new Date(f.due_at).getTime() < Date.now();
                return (
                  <div key={f.id} className="flex items-start justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className={overdue ? "font-medium text-destructive" : "font-medium"}>
                        {formatDateTime(f.due_at)} {overdue && "· overdue"}
                      </p>
                      {f.note && <p className="text-muted-foreground">{f.note}</p>}
                    </div>
                    <Badge variant={f.status === "snoozed" ? "secondary" : "outline"}>
                      {f.status}
                    </Badge>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {engagement && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  Engagement
                </CardTitle>
              </CardHeader>
              <CardContent className="divide-y">
                <InfoRow
                  label="Demo viewed"
                  value={
                    engagement.viewed ? (
                      <Badge variant="success">Yes</Badge>
                    ) : (
                      <Badge variant="outline">Not yet</Badge>
                    )
                  }
                />
                {engagement.viewed && (
                  <>
                    <InfoRow
                      label="First / last view"
                      value={`${formatRelative(engagement.firstViewedAt)} → ${formatRelative(
                        engagement.lastViewedAt
                      )}`}
                    />
                    <InfoRow
                      label="Views"
                      value={`${engagement.viewCount} (${engagement.uniqueVisitors} unique)`}
                    />
                    <InfoRow
                      label="Avg. time on page"
                      value={
                        engagement.avgDurationSec > 0 ? `${engagement.avgDurationSec}s` : "—"
                      }
                    />
                    <InfoRow
                      label="Most-read sections"
                      value={
                        engagement.topSections.length > 0
                          ? engagement.topSections.map((s) => s.section).join(", ")
                          : "—"
                      }
                    />
                    <InfoRow
                      label="CTA clicks"
                      value={`Call ${engagement.ctaClicks.call} · WhatsApp ${engagement.ctaClicks.whatsapp} · Appointment ${engagement.ctaClicks.appointment}`}
                    />
                  </>
                )}
              </CardContent>
            </Card>
          )}

          <OutreachPanel
            leadId={lead.id}
            hasEmail={lead.email !== null}
            whatsappTemplates={whatsappTemplates}
            emailTemplates={emailTemplates}
            messages={messages}
          />

          <QuotationsPanel leadId={lead.id} quotations={quotations} />

          <ConvertToClientCard lead={lead} sites={sites} client={client} />
        </div>

        {/* Right: timeline */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-4 w-4 text-muted-foreground" />
              Activity timeline
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <NoteForm leadId={lead.id} />
            <Separator />
            {activities.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No activity yet. Status changes, notes, messages and demo views land here
                automatically.
              </p>
            )}
            <ol className="relative space-y-5 before:absolute before:inset-y-1 before:left-[15px] before:w-px before:bg-border">
              {activities.map((activity) => {
                const Icon = ACTIVITY_ICONS[activity.type];
                return (
                  <li key={activity.id} className="relative flex gap-3 pl-0">
                    <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-background">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    </span>
                    <div className="min-w-0 pt-1">
                      <p className="text-sm">{activity.title}</p>
                      <p className="text-xs text-muted-foreground" title={formatDateTime(activity.created_at)}>
                        {formatRelative(activity.created_at)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
