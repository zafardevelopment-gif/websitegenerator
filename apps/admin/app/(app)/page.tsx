import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Flame,
  Globe,
  MessageCircle,
  MessageCircleReply,
  Percent,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";

import { SETTING_KEYS } from "@aiwebsite/config";
import { isEncryptionConfigured } from "@aiwebsite/db/crypto";
import { createServerSupabase } from "@aiwebsite/db/server";
import { getMonthlyAiCost, type AiMonthlyCost } from "@aiwebsite/db/repositories/ai-usage";
import { countLeadsByStatus } from "@aiwebsite/db/repositories/leads";
import {
  getWhatsAppStats,
  listRecentWhatsAppReplies,
  type RecentReply,
  type WhatsAppStats,
} from "@aiwebsite/db/repositories/messages";
import { getAgencyProfile, getSettingsStatus } from "@aiwebsite/db/settings";
import { listHotLeads, type HotLeadRow } from "@aiwebsite/db/repositories/tracking";
import { listSites } from "@aiwebsite/db/repositories/sites";
import type { LeadStatus } from "@aiwebsite/db/types";
import { getUserProfile } from "@aiwebsite/db/users";

import { LEAD_STATUS_LABELS } from "@/lib/lead-meta";
import { loadAiConfig } from "@/lib/server/ai-engine";
import { demoUrl } from "@/lib/urls";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
} from "@aiwebsite/ui";
import { formatRelative } from "@/lib/format";

const PIPELINE_STAGES: LeadStatus[] = [
  "new",
  "website_generated",
  "whatsapp_sent",
  "demo_viewed",
  "interested",
  "meeting",
  "won",
];

const STAGE_COLORS: Record<string, string> = {
  new: "bg-slate-400",
  website_generated: "bg-blue-500",
  whatsapp_sent: "bg-violet-500",
  demo_viewed: "bg-amber-500",
  interested: "bg-orange-500",
  meeting: "bg-rose-500",
  won: "bg-emerald-500",
};

export default async function DashboardPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user ? await getUserProfile(supabase, user.id) : null;
  const agency = await getAgencyProfile(supabase);

  const keys = await getSettingsStatus(supabase, [
    SETTING_KEYS.anthropicApiKey,
    SETTING_KEYS.geminiApiKey,
    SETTING_KEYS.whatsappCloudPhoneNumberId,
    SETTING_KEYS.whatsappCloudAccessToken,
    SETTING_KEYS.whatsappCloudVerifyToken,
  ]);

  let aiCost: AiMonthlyCost | null = null;
  let aiBudget = 0;
  try {
    aiCost = await getMonthlyAiCost(supabase);
    aiBudget = (await loadAiConfig(supabase)).monthlyBudgetInr;
  } catch {
    aiCost = null;
  }
  const budgetUsed = aiCost && aiBudget > 0 ? aiCost.totalCostInr / aiBudget : 0;

  let hotLeads: HotLeadRow[] = [];
  let waStats: WhatsAppStats | null = null;
  let recentReplies: RecentReply[] = [];
  let funnelCounts: Record<LeadStatus, number> | null = null;
  let allSites: Awaited<ReturnType<typeof listSites>> = [];

  try {
    [hotLeads, waStats, recentReplies, funnelCounts, allSites] = await Promise.all([
      listHotLeads(supabase, 48, 5),
      getWhatsAppStats(supabase, 30),
      listRecentWhatsAppReplies(supabase, 5),
      countLeadsByStatus(supabase),
      listSites(supabase, {}, 1000),
    ]);
  } catch {
    hotLeads = [];
    waStats = null;
    recentReplies = [];
    funnelCounts = null;
    allSites = [];
  }

  const totalLeads = funnelCounts
    ? Object.values(funnelCounts).reduce((a, b) => a + b, 0)
    : 0;
  const wonLeads = funnelCounts?.won ?? 0;
  const interestedLeads = funnelCounts?.interested ?? 0;
  const liveSites = allSites.filter((s) => s.status === "live").length;
  const totalSites = allSites.length;
  const conversionRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;

  const cloudConfigured =
    (keys[SETTING_KEYS.whatsappCloudPhoneNumberId]?.isSet ?? false) &&
    (keys[SETTING_KEYS.whatsappCloudAccessToken]?.isSet ?? false);
  const webhookConfigured = keys[SETTING_KEYS.whatsappCloudVerifyToken]?.isSet ?? false;

  const displayName = profile?.full_name?.trim() || profile?.email?.split("@")[0] || "there";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {greeting}, {displayName} 👋
          </h1>
          <p className="text-sm text-muted-foreground">
            {agency.name || "AIVEXA"} · {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/leads/new"
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
          >
            <Users className="h-3.5 w-3.5" /> New lead
          </Link>
          <Link
            href="/generator"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Globe className="h-3.5 w-3.5" /> Generator
          </Link>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: "Total leads",
            value: totalLeads,
            sub: `${interestedLeads} interested`,
            icon: Users,
            href: "/leads",
            color: "text-blue-500",
          },
          {
            label: "Sites built",
            value: totalSites,
            sub: `${liveSites} live`,
            icon: Globe,
            href: "/generator",
            color: "text-violet-500",
          },
          {
            label: "WA sent (30d)",
            value: waStats?.sent ?? 0,
            sub: `${waStats?.repliedLeads ?? 0} replied`,
            icon: MessageCircle,
            href: "/outreach",
            color: "text-green-500",
          },
          {
            label: "Won",
            value: wonLeads,
            sub: `${conversionRate}% conv. rate`,
            icon: TrendingUp,
            href: "/leads?status=won",
            color: "text-emerald-500",
          },
        ].map((kpi) => (
          <Link key={kpi.label} href={kpi.href}>
            <Card className="cursor-pointer transition-shadow hover:shadow-md">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{kpi.label}</p>
                    <p className="mt-1 text-2xl font-bold tabular-nums">{kpi.value}</p>
                    <p className="text-xs text-muted-foreground">{kpi.sub}</p>
                  </div>
                  <kpi.icon className={cn("h-5 w-5 shrink-0", kpi.color)} />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Main content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Pipeline funnel */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Lead pipeline</CardTitle>
              <Link href="/leads" className="flex items-center gap-0.5 text-xs text-primary hover:underline">
                View all <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {funnelCounts === null ? (
              <p className="text-sm text-muted-foreground">No lead data yet.</p>
            ) : (
              <div className="space-y-2.5">
                {PIPELINE_STAGES.map((status) => {
                  const count = funnelCounts?.[status] ?? 0;
                  const max = Math.max(1, ...PIPELINE_STAGES.map((s) => funnelCounts?.[s] ?? 0));
                  const pct = Math.round((count / max) * 100);
                  return (
                    <Link key={status} href={`/leads?status=${status}`} className="block">
                      <div className="flex items-center gap-3 rounded-md px-1 py-0.5 hover:bg-muted/50">
                        <span className="w-28 shrink-0 truncate text-xs text-muted-foreground">
                          {LEAD_STATUS_LABELS[status]}
                        </span>
                        <div className="relative h-5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn("h-full rounded-full transition-all", STAGE_COLORS[status] ?? "bg-primary")}
                            style={{ width: `${pct}%` }}
                          />
                          {count > 0 && (
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-medium text-white">
                              {count}
                            </span>
                          )}
                        </div>
                        <span className="w-7 shrink-0 text-right text-xs font-semibold tabular-nums">
                          {count}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { label: "Generate a website", icon: Globe, href: "/generator", desc: "Lead → site in 3 min" },
              { label: "Send WhatsApp blast", icon: Zap, href: "/generator", desc: "Use ⚡ on any card" },
              { label: "View follow-ups", icon: MessageCircleReply, href: "/follow-ups", desc: "Pending callbacks" },
              { label: "Find new leads", icon: Users, href: "/leads?tab=find", desc: "Google Maps scraper" },
              { label: "Analytics", icon: TrendingUp, href: "/analytics", desc: "Full funnel data" },
            ].map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className="flex items-center gap-3 rounded-md border p-2.5 text-sm hover:bg-muted/50 transition-colors"
              >
                <action.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-none">{action.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{action.desc}</p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Hot leads */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Flame className="h-4 w-4 text-destructive" />
                Hot leads
              </CardTitle>
              <span className="text-xs text-muted-foreground">Last 48h</span>
            </div>
          </CardHeader>
          <CardContent>
            {hotLeads.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No demo views in the last 48 hours yet.
              </p>
            ) : (
              <div className="space-y-3">
                {hotLeads.map((hot) => (
                  <div key={hot.siteId} className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/leads/${hot.leadId}`}
                        className="truncate text-sm font-medium hover:text-primary hover:underline block"
                      >
                        {hot.businessName}
                      </Link>
                      <p className="text-xs text-muted-foreground">{formatRelative(hot.lastViewedAt)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Badge variant="warning" className="text-[10px]">
                        {hot.viewCount}×
                      </Badge>
                      <a
                        href={demoUrl(hot.slug)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-muted-foreground hover:text-primary"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* WhatsApp */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageCircle className="h-4 w-4 text-green-500" />
                WhatsApp (30 days)
              </CardTitle>
              {!cloudConfigured && (
                <Link href="/settings/api-keys" className="text-xs text-destructive hover:underline">
                  Cloud API not set up →
                </Link>
              )}
              {cloudConfigured && !webhookConfigured && (
                <Link href="/settings/api-keys" className="text-xs text-amber-500 hover:underline">
                  Webhook not configured →
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {waStats === null ? (
              <p className="text-sm text-muted-foreground">No WhatsApp activity yet.</p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { label: "Sent", value: waStats.sent },
                    { label: "Delivered", value: waStats.delivered },
                    { label: "Read", value: waStats.read },
                    { label: "Replied", value: waStats.repliedLeads },
                    { label: "Failed", value: waStats.failed },
                  ].map((s) => (
                    <div key={s.label} className="rounded-lg border p-2 text-center">
                      <p className="text-xl font-bold tabular-nums">{s.value}</p>
                      <p className="text-[10px] text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <Percent className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-semibold tabular-nums">{Math.round(waStats.replyRate * 100)}%</span>
                  <span className="text-muted-foreground">reply rate</span>
                </div>

                {recentReplies.length > 0 ? (
                  <div className="space-y-1 border-t pt-3">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Recent replies</p>
                    {recentReplies.map((reply) => (
                      <Link
                        key={reply.id}
                        href={`/leads/${reply.leadId}`}
                        className="group flex items-start justify-between gap-2 rounded-md p-1.5 hover:bg-muted cursor-pointer"
                      >
                        <div className="min-w-0">
                          <span className="text-sm font-medium group-hover:text-primary group-hover:underline">{reply.businessName}</span>
                          <p className="truncate text-xs text-muted-foreground">{reply.body}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <span className="text-[10px] text-muted-foreground">{formatRelative(reply.createdAt)}</span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="border-t pt-3 text-xs text-muted-foreground">
                    {webhookConfigured
                      ? "No replies captured yet — replies will auto-appear once a lead responds."
                      : "Configure the Meta webhook in Settings to capture replies automatically."}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI cost + status row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="h-4 w-4 text-muted-foreground" />
              AI spend this month
            </CardTitle>
          </CardHeader>
          <CardContent>
            {aiCost === null ? (
              <p className="text-sm text-muted-foreground">No AI usage yet.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold tabular-nums">₹{aiCost.totalCostInr.toFixed(2)}</span>
                  {aiBudget > 0 && (
                    <span className="text-sm text-muted-foreground">of ₹{aiBudget.toLocaleString("en-IN")}</span>
                  )}
                </div>
                {aiBudget > 0 && (
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full", budgetUsed >= 0.8 ? "bg-destructive" : "bg-primary")}
                      style={{ width: `${Math.min(100, budgetUsed * 100)}%` }}
                    />
                  </div>
                )}
                {budgetUsed >= 0.8 && (
                  <p className="flex items-center gap-1.5 text-sm font-medium text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    {Math.round(budgetUsed * 100)}% of budget used
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {aiCost.calls} calls · {aiCost.totalTokensIn.toLocaleString()} in · {aiCost.totalTokensOut.toLocaleString()} out
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">System status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {[
              { label: "Encryption", done: isEncryptionConfigured(), hint: "API key storage secure" },
              { label: "Agency profile", done: agency.name.trim() !== "", href: "/settings", hint: "Shown on proposals" },
              { label: "WhatsApp Cloud API", done: cloudConfigured, href: "/settings/api-keys", hint: "Auto-send templates" },
              { label: "Inbound webhook", done: webhookConfigured, href: "/settings/api-keys", hint: "Capture lead replies" },
              {
                label: "AI provider",
                done: (keys[SETTING_KEYS.anthropicApiKey]?.isSet ?? false) || (keys[SETTING_KEYS.geminiApiKey]?.isSet ?? false),
                href: "/settings/api-keys",
                hint: "Claude / Gemini content engine",
              },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3">
                <CheckCircle2
                  className={cn(
                    "h-4 w-4 shrink-0",
                    item.done ? "text-emerald-500" : "text-muted-foreground/30"
                  )}
                />
                <div className="flex-1 min-w-0">
                  <span className={cn("text-sm", !item.done && "text-muted-foreground")}>{item.label}</span>
                  <p className="text-xs text-muted-foreground">{item.hint}</p>
                </div>
                {!item.done && item.href && (
                  <Link href={item.href} className="shrink-0 text-xs text-primary hover:underline">
                    Setup →
                  </Link>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
