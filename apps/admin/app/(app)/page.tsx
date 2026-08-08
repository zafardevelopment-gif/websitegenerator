import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Circle,
  Flame,
  MessageCircle,
  MessageCircleReply,
  Percent,
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
  Separator,
} from "@aiwebsite/ui";
import { formatRelative } from "@/lib/format";

const FUNNEL_SUMMARY: LeadStatus[] = [
  "new",
  "website_generated",
  "whatsapp_sent",
  "demo_viewed",
  "interested",
  "won",
];

interface ChecklistItem {
  label: string;
  done: boolean;
  href: string | null;
  hint: string;
}

const ROADMAP: { phase: string; label: string; status: "done" | "current" | "next" }[] = [
  { phase: "0–9", label: "Foundation → templates → AI → generator → media → deploy", status: "done" },
  { phase: "10", label: "Demo engagement tracking + hot leads + notifications", status: "current" },
  { phase: "11–12", label: "Outreach suite, follow-up manager", status: "next" },
  { phase: "13–14", label: "Analytics, health scores, conversion & payments", status: "next" },
  { phase: "15", label: "Hardening & launch", status: "next" },
];

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
  ]);

  // AI spend this month (tolerates the table not existing yet).
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
  try {
    hotLeads = await listHotLeads(supabase, 48, 8);
  } catch {
    hotLeads = [];
  }

  let waStats: WhatsAppStats | null = null;
  let recentReplies: RecentReply[] = [];
  let funnelCounts: Record<LeadStatus, number> | null = null;
  try {
    [waStats, recentReplies, funnelCounts] = await Promise.all([
      getWhatsAppStats(supabase, 30),
      listRecentWhatsAppReplies(supabase, 6),
      countLeadsByStatus(supabase),
    ]);
  } catch {
    waStats = null;
    recentReplies = [];
    funnelCounts = null;
  }

  const checklist: ChecklistItem[] = [
    {
      label: "Database migration applied & signed in",
      done: true, // being here with a profile row proves both
      href: null,
      hint: "Done — your team row exists.",
    },
    {
      label: "Fill in the agency profile",
      done: agency.name.trim() !== "",
      href: "/settings",
      hint: "Name, WhatsApp and address appear on demo banners, proposals and PDFs.",
    },
    {
      label: "Encryption key configured",
      done: isEncryptionConfigured(),
      href: null,
      hint: "SETTINGS_ENCRYPTION_KEY in apps/admin/.env.local — protects stored API keys.",
    },
    {
      label: "Add an AI provider key (used from Phase 6)",
      done: (keys[SETTING_KEYS.anthropicApiKey]?.isSet ?? false) ||
        (keys[SETTING_KEYS.geminiApiKey]?.isSet ?? false),
      href: "/settings/api-keys",
      hint: "Claude is the primary content engine; Gemini is the fallback.",
    },
  ];

  const displayName = profile?.full_name?.trim() || profile?.email || "there";

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome, {displayName}</h1>
        <p className="text-sm text-muted-foreground">
          Foundation is live. KPI cards, hot leads and activity land here as their modules ship.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-destructive" />
            Hot leads
          </CardTitle>
          <CardDescription>Demos viewed in the last 48 hours, ranked by view count.</CardDescription>
        </CardHeader>
        <CardContent>
          {hotLeads.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No demo views in the last 48 hours yet — once a demo goes live and gets viewed,
              it&apos;ll show up here first.
            </p>
          ) : (
            <div className="divide-y">
              {hotLeads.map((hot) => (
                <div key={hot.siteId} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Link
                      href={`/leads/${hot.leadId}`}
                      className="truncate font-medium hover:text-primary hover:underline"
                    >
                      {hot.businessName}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      Last viewed {formatRelative(hot.lastViewedAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="warning">
                      {hot.viewCount} view{hot.viewCount === 1 ? "" : "s"}
                    </Badge>
                    <a
                      href={demoUrl(hot.slug)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary hover:underline"
                    >
                      View demo
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-success" />
              WhatsApp outreach
              <Badge variant="outline" className="ml-auto text-[10px]">
                Last 30 days
              </Badge>
            </CardTitle>
            <CardDescription>
              Auto-sent on generate via Meta Cloud API, plus manual sends from the generator page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {waStats === null ? (
              <p className="text-sm text-muted-foreground">
                No WhatsApp activity yet — messages will show up here once you generate a site or
                send from a lead.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {[
                    { label: "Sent", value: waStats.sent },
                    { label: "Delivered", value: waStats.delivered },
                    { label: "Read", value: waStats.read },
                    { label: "Replied", value: waStats.repliedLeads },
                    { label: "Failed", value: waStats.failed },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-md border p-2.5 text-center">
                      <p className="text-xl font-semibold tabular-nums">{stat.value}</p>
                      <p className="text-[11px] text-muted-foreground">{stat.label}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-sm">
                  <Percent className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium tabular-nums">
                    {Math.round(waStats.replyRate * 100)}%
                  </span>
                  <span className="text-muted-foreground">reply rate</span>
                </div>

                {recentReplies.length > 0 && (
                  <div className="mt-4 space-y-2 border-t pt-3">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <MessageCircleReply className="h-3.5 w-3.5" />
                      Recent replies
                    </p>
                    {recentReplies.map((reply) => (
                      <Link
                        key={reply.id}
                        href={`/leads/${reply.leadId}`}
                        className="block rounded-md p-1.5 text-sm hover:bg-muted"
                      >
                        <span className="font-medium">{reply.businessName}</span>
                        <span className="text-muted-foreground"> · {formatRelative(reply.createdAt)}</span>
                        <p className="truncate text-xs text-muted-foreground">{reply.body}</p>
                      </Link>
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pipeline snapshot</CardTitle>
            <CardDescription>Leads at each stage right now.</CardDescription>
          </CardHeader>
          <CardContent>
            {funnelCounts === null ? (
              <p className="text-sm text-muted-foreground">No lead data yet.</p>
            ) : (
              <div className="space-y-2">
                {FUNNEL_SUMMARY.map((status) => {
                  const count = funnelCounts?.[status] ?? 0;
                  const max = Math.max(1, ...FUNNEL_SUMMARY.map((s) => funnelCounts?.[s] ?? 0));
                  return (
                    <div key={status} className="flex items-center gap-3">
                      <span className="w-32 shrink-0 truncate text-xs text-muted-foreground">
                        {LEAD_STATUS_LABELS[status]}
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${(count / max) * 100}%` }}
                        />
                      </div>
                      <span className="w-8 shrink-0 text-right text-xs font-medium tabular-nums">
                        {count}
                      </span>
                    </div>
                  );
                })}
                <Link
                  href="/analytics"
                  className="inline-flex items-center gap-1 pt-1 text-xs font-medium text-primary hover:underline"
                >
                  Full funnel &amp; analytics <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Setup checklist</CardTitle>
            <CardDescription>Get the workspace production-ready.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {checklist.map((item, i) => (
              <div key={item.label}>
                {i > 0 && <Separator className="my-3" />}
                <div className="flex items-start gap-3">
                  {item.done ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                  ) : (
                    <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground/40" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm font-medium", item.done && "text-muted-foreground")}>
                      {item.label}
                    </p>
                    <p className="text-xs text-muted-foreground">{item.hint}</p>
                  </div>
                  {!item.done && item.href && (
                    <Link
                      href={item.href}
                      className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      Fix <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-muted-foreground" />
              AI cost this month
            </CardTitle>
            <CardDescription>
              Every AI call is logged with tokens and a ₹ estimate.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {aiCost === null ? (
              <p className="text-sm text-muted-foreground">
                No usage data yet — configure keys in Settings → AI and run a test.
              </p>
            ) : (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-semibold tabular-nums">
                    ₹{aiCost.totalCostInr.toFixed(2)}
                  </span>
                  {aiBudget > 0 && (
                    <span className="text-sm text-muted-foreground">
                      of ₹{aiBudget.toLocaleString("en-IN")} budget
                    </span>
                  )}
                </div>
                {aiBudget > 0 && (
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        budgetUsed >= 0.8 ? "bg-destructive" : "bg-primary"
                      )}
                      style={{ width: `${Math.min(100, budgetUsed * 100)}%` }}
                    />
                  </div>
                )}
                {budgetUsed >= 0.8 && (
                  <p className="flex items-center gap-1.5 text-sm font-medium text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    {Math.round(budgetUsed * 100)}% of the monthly AI budget used
                  </p>
                )}
                <p className="text-sm text-muted-foreground">
                  {aiCost.calls} call{aiCost.calls === 1 ? "" : "s"} ·{" "}
                  {aiCost.totalTokensIn.toLocaleString()} tokens in ·{" "}
                  {aiCost.totalTokensOut.toLocaleString()} tokens out
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Build roadmap</CardTitle>
            <CardDescription>Where we are in the phase plan.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {ROADMAP.map((step) => (
              <div key={step.phase} className="flex items-center gap-3">
                <Badge
                  variant={step.status === "current" ? "default" : "outline"}
                  className="w-14 justify-center font-mono text-[10px]"
                >
                  P{step.phase}
                </Badge>
                <p
                  className={cn(
                    "text-sm",
                    step.status === "current" ? "font-medium" : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
