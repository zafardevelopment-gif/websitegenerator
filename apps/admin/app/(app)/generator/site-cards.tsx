"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, Loader2, MessageCircle, Pencil, Search, User, Zap } from "lucide-react";
import { toast } from "sonner";

import type { LeadStatus, SiteStatus } from "@aiwebsite/db/types";
import { Badge, Button, Card, CardContent, Input, NativeSelect } from "@aiwebsite/ui";

import { LeadStatusBadge } from "@/components/lead-badges";
import { formatRelative } from "@/lib/format";
import { LEAD_STATUSES, LEAD_STATUS_LABELS } from "@/lib/lead-meta";
import { sendDemoPitchTemplateAction } from "@/lib/actions/outreach";

import { WhatsAppSendDialog, type WhatsAppTarget } from "./whatsapp-send-dialog";

const STATUS_VARIANT = {
  draft: "secondary",
  live: "success",
  paused: "warning",
  expired: "destructive",
  archived: "outline",
  converted: "default",
} as const;

const SITE_STATUSES: SiteStatus[] = ["draft", "live", "paused", "expired", "archived", "converted"];

export type GeneratorSiteCard = {
  id: string;
  name: string;
  slug: string;
  status: SiteStatus;
  updatedAt: string;
  demoLink: string;
  leadId: string;
  leadStatus: LeadStatus | null;
  ownerName: string | null;
  phone: string | null;
  category: string | null;
};

export function SiteCards({
  sites,
  callNumber,
  cloudConfigured,
}: {
  sites: GeneratorSiteCard[];
  callNumber?: string | null;
  cloudConfigured?: boolean;
}) {
  const [target, setTarget] = React.useState<WhatsAppTarget | null>(null);
  const [sendingLeadId, setSendingLeadId] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [leadStatus, setLeadStatus] = React.useState<LeadStatus | "all">("all");
  const [siteStatus, setSiteStatus] = React.useState<SiteStatus | "all">("all");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return sites.filter((site) => {
      if (leadStatus !== "all" && site.leadStatus !== leadStatus) return false;
      if (siteStatus !== "all" && site.status !== siteStatus) return false;
      if (
        q &&
        !site.name.toLowerCase().includes(q) &&
        !site.slug.toLowerCase().includes(q) &&
        !(site.ownerName ?? "").toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [sites, query, leadStatus, siteStatus]);

  async function sendViaTemplate(site: GeneratorSiteCard) {
    if (!site.phone || sendingLeadId) return;
    setSendingLeadId(site.leadId);
    try {
      const result = await sendDemoPitchTemplateAction({
        leadId: site.leadId,
        demoLink: site.demoLink,
      });
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    } finally {
      setSendingLeadId(null);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search name, slug, owner..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <NativeSelect
          aria-label="Filter by lead status"
          className="w-48"
          value={leadStatus}
          onChange={(e) => setLeadStatus(e.target.value as LeadStatus | "all")}
        >
          <option value="all">All lead statuses</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {LEAD_STATUS_LABELS[s]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Filter by site status"
          className="w-40"
          value={siteStatus}
          onChange={(e) => setSiteStatus(e.target.value as SiteStatus | "all")}
        >
          <option value="all">All site statuses</option>
          {SITE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </NativeSelect>
        {(query || leadStatus !== "all" || siteStatus !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQuery("");
              setLeadStatus("all");
              setSiteStatus("all");
            }}
          >
            Clear
          </Button>
        )}
        <span className="text-xs text-muted-foreground">
          {filtered.length} of {sites.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            No websites match these filters.
          </CardContent>
        </Card>
      ) : (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((site) => (
          <Card key={site.id} className="flex h-full flex-col">
            <CardContent className="flex flex-1 flex-col gap-2 p-5">
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={`/generator/${site.id}`}
                  className="font-medium leading-snug hover:text-primary hover:underline"
                >
                  {site.name}
                </Link>
                <Badge variant={STATUS_VARIANT[site.status]}>{site.status}</Badge>
              </div>

              <p className="font-mono text-xs text-muted-foreground">{site.slug}</p>

              <div className="flex flex-wrap items-center gap-1.5">
                {site.leadStatus ? (
                  <Link href={`/leads/${site.leadId}`}>
                    <LeadStatusBadge status={site.leadStatus} />
                  </Link>
                ) : (
                  <span className="text-xs text-muted-foreground">Lead not found</span>
                )}
                {site.ownerName && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    {site.ownerName}
                  </span>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Updated {formatRelative(site.updatedAt)}
              </p>

              <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  disabled={!site.phone}
                  title={site.phone ? undefined : "No WhatsApp number on this lead"}
                  onClick={() =>
                    setTarget({
                      leadId: site.leadId,
                      siteName: site.name,
                      ownerName: site.ownerName,
                      phone: site.phone,
                      demoLink: site.demoLink,
                      category: site.category,
                      callNumber,
                      cloudConfigured,
                    })
                  }
                >
                  <MessageCircle />
                  WhatsApp
                </Button>
                {cloudConfigured && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 border-green-500/40 text-green-700 hover:bg-green-500/10 dark:text-green-400"
                    disabled={!site.phone || sendingLeadId !== null}
                    title={site.phone ? "Send demo_pitch_intro via Meta Cloud API" : "No WhatsApp number on this lead"}
                    onClick={() => sendViaTemplate(site)}
                  >
                    {sendingLeadId === site.leadId ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Zap className="h-3.5 w-3.5" />
                    )}
                  </Button>
                )}
                <Button size="sm" variant="outline" asChild>
                  <a href={site.demoLink} target="_blank" rel="noreferrer" title="Open demo">
                    <ExternalLink />
                  </a>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/generator/${site.id}`} title="Open editor">
                    <Pencil />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      )}

      <WhatsAppSendDialog target={target} onOpenChange={(open) => !open && setTarget(null)} />
    </>
  );
}
