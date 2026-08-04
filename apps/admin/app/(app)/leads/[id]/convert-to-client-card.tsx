"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Rocket } from "lucide-react";
import { toast } from "sonner";

import type { ClientRow, LeadRow, SiteRow } from "@aiwebsite/db/types";
import { Button, Card, CardContent, CardHeader, CardTitle, NativeSelect } from "@aiwebsite/ui";

import { convertLeadToClientAction } from "@/lib/actions/clients";

export function ConvertToClientCard({
  lead,
  sites,
  client,
}: {
  lead: LeadRow;
  sites: SiteRow[];
  client: ClientRow | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const liveSites = sites.filter((s) => s.status === "live");
  const [siteId, setSiteId] = React.useState(liveSites[0]?.id ?? "");

  if (client) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-success">
            <CheckCircle2 className="h-4 w-4" />
            Converted to client
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This lead is now a permanent client project. Manage renewals and onboarding from{" "}
            <Link href="/clients" className="text-primary hover:underline">
              Clients
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    );
  }

  function convert() {
    if (!siteId) return;
    startTransition(async () => {
      const result = await convertLeadToClientAction({ leadId: lead.id, siteId });
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Rocket className="h-4 w-4 text-muted-foreground" />
          Convert to permanent client
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {liveSites.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Publish a website (status: live) before converting this lead to a client.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Removes the demo banner, enables search indexing, and creates a client record for
              renewals and onboarding.
            </p>
            <NativeSelect value={siteId} onChange={(e) => setSiteId(e.target.value)}>
              {liveSites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.slug})
                </option>
              ))}
            </NativeSelect>
            <Button onClick={convert} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Rocket />}
              Convert demo to client
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
