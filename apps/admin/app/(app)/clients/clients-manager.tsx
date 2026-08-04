"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { ClientRow, DomainRow } from "@aiwebsite/db/types";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Textarea,
} from "@aiwebsite/ui";

import { addDomainAction, removeDomainAction, verifyDomainAction } from "@/lib/actions/domains";
import {
  generateHandoverPackAction,
  setChecklistItemAction,
  updateClientRecordAction,
} from "@/lib/actions/clients";
import { REQUIREMENTS_CHECKLIST_ITEMS } from "@/lib/constants/clients";
import { formatDate } from "@/lib/format";

function downloadBase64Pdf(base64: string, fileName: string) {
  const bytes = atob(base64);
  const array = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) array[i] = bytes.charCodeAt(i);
  const blob = new Blob([array], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function HandoverPackButton({ clientId }: { clientId: string }) {
  const [pending, startTransition] = React.useTransition();

  function download() {
    startTransition(async () => {
      const result = await generateHandoverPackAction({ clientId });
      if (result.ok && result.data) {
        downloadBase64Pdf(result.data.base64, result.data.fileName);
      } else if (!result.ok) {
        toast.error(result.error);
      }
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={download} disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <Download />}
      Handover pack
    </Button>
  );
}

const DOMAIN_STATUS_VARIANT: Record<string, "secondary" | "success" | "destructive" | "outline"> = {
  pending_dns: "secondary",
  verifying: "outline",
  active: "success",
  failed: "destructive",
  removed: "destructive",
};

function ChecklistBlock({ client }: { client: ClientRow }) {
  const [pending, startTransition] = React.useTransition();
  const router = useRouter();
  const checklist =
    typeof client.onboarding_checklist === "object" && client.onboarding_checklist !== null
      ? (client.onboarding_checklist as Record<string, boolean>)
      : {};

  function toggle(key: string, checked: boolean) {
    startTransition(async () => {
      const result = await setChecklistItemAction({ clientId: client.id, key, checked });
      if (result.ok) router.refresh();
      else toast.error(result.error);
    });
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">Onboarding checklist</p>
      {REQUIREMENTS_CHECKLIST_ITEMS.map((item) => (
        <label key={item.key} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(checklist[item.key])}
            disabled={pending}
            onChange={(e) => toggle(item.key, e.target.checked)}
            className="h-4 w-4 rounded border-input"
          />
          {item.label}
        </label>
      ))}
    </div>
  );
}

function DomainBlock({
  client,
  domains,
  configured,
}: {
  client: ClientRow;
  domains: DomainRow[];
  configured: boolean;
}) {
  const [domain, setDomain] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const router = useRouter();

  function add() {
    if (!client.site_id || !domain.trim()) return;
    startTransition(async () => {
      const result = await addDomainAction({ siteId: client.site_id, domain: domain.trim() });
      if (result.ok) {
        toast.success(result.message);
        setDomain("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function verify(d: DomainRow) {
    if (!client.site_id) return;
    startTransition(async () => {
      const result = await verifyDomainAction({ domainId: d.id, domain: d.domain, siteId: client.site_id! });
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function remove(d: DomainRow) {
    startTransition(async () => {
      const result = await removeDomainAction({ domainId: d.id, domain: d.domain });
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Custom domain</p>
      {!configured && (
        <p className="text-xs text-muted-foreground">
          Not configured — set VERCEL_API_TOKEN and VERCEL_PROJECT_ID_SITES to enable.
        </p>
      )}
      {domains
        .filter((d) => d.status !== "removed")
        .map((d) => (
          <div key={d.id} className="rounded-md border p-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-medium">{d.domain}</span>
              <Badge variant={DOMAIN_STATUS_VARIANT[d.status] ?? "outline"}>{d.status}</Badge>
            </div>
            {d.status !== "active" && (
              <div className="mt-2 space-y-1">
                {(d.verification as { instructions?: { type: string; name: string; value: string }[] } | null)
                  ?.instructions?.map((ins, i) => (
                    <p key={i} className="font-mono text-xs text-muted-foreground">
                      {ins.type} {ins.name} → {ins.value}
                    </p>
                  ))}
              </div>
            )}
            <div className="mt-2 flex gap-1.5">
              {d.status !== "active" && (
                <Button variant="outline" size="sm" onClick={() => verify(d)} disabled={pending}>
                  {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                  Check verification
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => remove(d)} disabled={pending}>
                <Trash2 />
              </Button>
            </div>
          </div>
        ))}
      {configured && (
        <div className="flex gap-2">
          <Input
            placeholder="www.clientdomain.com"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
          />
          <Button variant="outline" onClick={add} disabled={pending || !domain.trim()}>
            <Plus />
            Add
          </Button>
        </div>
      )}
    </div>
  );
}

function RecordBlock({ client }: { client: ClientRow }) {
  const [domainExpiry, setDomainExpiry] = React.useState(client.domain_expiry ?? "");
  const [renewalDate, setRenewalDate] = React.useState(client.renewal_date ?? "");
  const [maintenanceNotes, setMaintenanceNotes] = React.useState(client.maintenance_notes ?? "");
  const [hostingNotes, setHostingNotes] = React.useState(client.hosting_notes ?? "");
  const [pending, startTransition] = React.useTransition();
  const router = useRouter();

  function save() {
    startTransition(async () => {
      const result = await updateClientRecordAction({
        clientId: client.id,
        domainExpiry: domainExpiry || null,
        renewalDate: renewalDate || null,
        maintenanceNotes: maintenanceNotes || null,
        hostingNotes: hostingNotes || null,
      });
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Renewal & notes</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Domain expiry</Label>
          <Input type="date" value={domainExpiry ?? ""} onChange={(e) => setDomainExpiry(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Renewal date</Label>
          <Input type="date" value={renewalDate ?? ""} onChange={(e) => setRenewalDate(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Maintenance notes</Label>
        <Textarea rows={2} value={maintenanceNotes ?? ""} onChange={(e) => setMaintenanceNotes(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Hosting notes</Label>
        <Textarea rows={2} value={hostingNotes ?? ""} onChange={(e) => setHostingNotes(e.target.value)} />
      </div>
      <Button size="sm" onClick={save} disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        Save
      </Button>
    </div>
  );
}

export function ClientsManager({
  clients,
  domainsByClient,
  domainConnectConfigured,
}: {
  clients: ClientRow[];
  domainsByClient: Record<string, DomainRow[]>;
  domainConnectConfigured: boolean;
}) {
  if (clients.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-sm text-muted-foreground">
          No clients yet — convert a won lead to a permanent project from its lead detail page.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {clients.map((client) => (
        <Card key={client.id}>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              {client.business_name}
            </CardTitle>
            <Badge variant={client.is_active ? "success" : "secondary"}>
              {client.is_active ? "active" : "inactive"}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Client since {formatDate(client.created_at)}
            </p>
            <ChecklistBlock client={client} />
            {client.site_id && (
              <DomainBlock
                client={client}
                domains={domainsByClient[client.id] ?? []}
                configured={domainConnectConfigured}
              />
            )}
            <RecordBlock client={client} />
            <HandoverPackButton clientId={client.id} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
