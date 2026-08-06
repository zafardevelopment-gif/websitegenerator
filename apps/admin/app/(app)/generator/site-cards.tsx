"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, MessageCircle, Pencil, User } from "lucide-react";

import type { LeadStatus, SiteStatus } from "@aiwebsite/db/types";
import { Badge, Button, Card, CardContent } from "@aiwebsite/ui";

import { LeadStatusBadge } from "@/components/lead-badges";
import { formatRelative } from "@/lib/format";

import { WhatsAppSendDialog, type WhatsAppTarget } from "./whatsapp-send-dialog";

const STATUS_VARIANT = {
  draft: "secondary",
  live: "success",
  paused: "warning",
  expired: "destructive",
  archived: "outline",
  converted: "default",
} as const;

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
};

export function SiteCards({ sites }: { sites: GeneratorSiteCard[] }) {
  const [target, setTarget] = React.useState<WhatsAppTarget | null>(null);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sites.map((site) => (
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
                    })
                  }
                >
                  <MessageCircle />
                  WhatsApp
                </Button>
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

      <WhatsAppSendDialog target={target} onOpenChange={(open) => !open && setTarget(null)} />
    </>
  );
}
