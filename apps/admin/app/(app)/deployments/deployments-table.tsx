"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  ExternalLink,
  FileClock,
  Loader2,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  QrCode,
  RefreshCw,
  Rocket,
  Trash2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

import type { DeploymentRow, SiteStatus } from "@aiwebsite/db/types";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Label,
} from "@aiwebsite/ui";

import { QrDialog } from "@/components/qr-dialog";
import {
  archiveSiteAction,
  deleteSiteDeployAction,
  listDeploymentsAction,
  pauseSiteAction,
  publishSiteAction,
  refreshSiteAction,
  resumeSiteAction,
  unpublishSiteAction,
  updateSlugAction,
} from "@/lib/actions/deploy";
import { formatDate, formatDateTime, formatRelative } from "@/lib/format";
import { demoUrl } from "@/lib/urls";

export interface DeploymentSiteView {
  id: string;
  name: string;
  slug: string;
  status: SiteStatus;
  mode: string;
  hasContent: boolean;
  demoExpiresAt: string | null;
  publishedAt: string | null;
  lastAction: string | null;
  lastActionAt: string | null;
}

const STATUS_VARIANT: Record<SiteStatus, "secondary" | "success" | "warning" | "destructive" | "outline" | "default"> = {
  draft: "secondary",
  live: "success",
  paused: "warning",
  expired: "destructive",
  archived: "outline",
  converted: "default",
};

export function DeploymentsTable({ sites }: { sites: DeploymentSiteView[] }) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [qrSite, setQrSite] = React.useState<DeploymentSiteView | null>(null);
  const [logsSite, setLogsSite] = React.useState<DeploymentSiteView | null>(null);
  const [logs, setLogs] = React.useState<DeploymentRow[] | null>(null);
  const [slugSite, setSlugSite] = React.useState<DeploymentSiteView | null>(null);
  const [slugValue, setSlugValue] = React.useState("");

  function run(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(result.message ?? "Done.");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed.");
      }
    });
  }

  function publish(site: DeploymentSiteView) {
    startTransition(async () => {
      const result = await publishSiteAction(site.id);
      if (result.ok && result.data) {
        toast.success(`Live at ${demoUrl(result.data.slug)}`);
        setQrSite({ ...site, status: "live", slug: result.data.slug });
        router.refresh();
      } else if (!result.ok) {
        toast.error(result.error);
      }
    });
  }

  function openLogs(site: DeploymentSiteView) {
    setLogsSite(site);
    setLogs(null);
    void listDeploymentsAction(site.id).then(setLogs);
  }

  function saveSlug() {
    if (!slugSite) return;
    startTransition(async () => {
      const result = await updateSlugAction({ siteId: slugSite.id, slug: slugValue });
      if (result.ok) {
        toast.success(result.message);
        setSlugSite(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 font-medium">Site</th>
              <th className="px-3 py-2.5 font-medium">URL</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium">Expires</th>
              <th className="px-3 py-2.5 font-medium">Last action</th>
              <th className="px-3 py-2.5 font-medium" />
            </tr>
          </thead>
          <tbody>
            {sites.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-12 text-center text-muted-foreground">
                  No sites yet — generate one first.
                </td>
              </tr>
            )}
            {sites.map((site) => {
              const url = demoUrl(site.slug);
              const expiringSoon =
                site.demoExpiresAt !== null &&
                new Date(site.demoExpiresAt).getTime() - Date.now() < 3 * 86400_000;
              return (
                <tr key={site.id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/generator/${site.id}`}
                      className="font-medium hover:text-primary hover:underline"
                    >
                      {site.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-primary"
                    >
                      {site.slug}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant={STATUS_VARIANT[site.status]}>{site.status}</Badge>
                  </td>
                  <td className="px-3 py-2.5">
                    {site.status === "live" && site.demoExpiresAt ? (
                      <span className={expiringSoon ? "font-medium text-destructive" : undefined}>
                        {formatDate(site.demoExpiresAt)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {site.lastAction
                      ? `${site.lastAction} · ${formatRelative(site.lastActionAt)}`
                      : "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {site.status === "live" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setQrSite(site)}
                          aria-label="QR code"
                        >
                          <QrCode />
                          QR
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          disabled={isPending || !site.hasContent}
                          onClick={() => publish(site)}
                        >
                          <Rocket />
                          Publish
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Actions for ${site.name}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          {site.status === "live" && (
                            <>
                              <DropdownMenuItem onSelect={() => run(() => refreshSiteAction(site.id))}>
                                <RefreshCw />
                                Refresh cache
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => run(() => pauseSiteAction(site.id))}>
                                <Pause />
                                Pause
                              </DropdownMenuItem>
                            </>
                          )}
                          {(site.status === "paused" || site.status === "expired") && (
                            <DropdownMenuItem onSelect={() => run(() => resumeSiteAction(site.id))}>
                              <Play />
                              {site.status === "expired" ? "Re-activate" : "Resume"}
                            </DropdownMenuItem>
                          )}
                          {site.status === "live" && (
                            <DropdownMenuItem onSelect={() => run(() => unpublishSiteAction(site.id))}>
                              <Undo2 />
                              Unpublish (back to draft)
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onSelect={() => {
                              setSlugSite(site);
                              setSlugValue(site.slug);
                            }}
                          >
                            <Pencil />
                            Change slug
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => openLogs(site)}>
                            <FileClock />
                            Deployment logs
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {site.status !== "archived" && (
                            <DropdownMenuItem onSelect={() => run(() => archiveSiteAction(site.id))}>
                              <Archive />
                              Archive
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onSelect={() => {
                              if (window.confirm(`Soft-delete ${site.name}? The URL stops serving immediately.`)) {
                                run(() => deleteSiteDeployAction(site.id));
                              }
                            }}
                          >
                            <Trash2 />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {qrSite && (
        <QrDialog
          url={demoUrl(qrSite.slug)}
          title={qrSite.name}
          open={qrSite !== null}
          onOpenChange={(open) => !open && setQrSite(null)}
        />
      )}

      {/* Slug dialog */}
      <Dialog open={slugSite !== null} onOpenChange={(open) => !open && setSlugSite(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Change subdomain</DialogTitle>
            <DialogDescription>
              The old URL stops working immediately — update any links you&apos;ve shared.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="slug-input">Slug</Label>
            <Input
              id="slug-input"
              value={slugValue}
              onChange={(e) => setSlugValue(e.target.value.toLowerCase())}
            />
            <p className="font-mono text-xs text-muted-foreground">{demoUrl(slugValue || "…")}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSlugSite(null)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={saveSlug} disabled={isPending || !slugValue}>
              {isPending ? <Loader2 className="animate-spin" /> : <Pencil />}
              Update slug
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Logs dialog */}
      <Dialog open={logsSite !== null} onOpenChange={(open) => !open && setLogsSite(null)}>
        <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Deployment log — {logsSite?.name}</DialogTitle>
            <DialogDescription>Newest first. Full audit trail per site.</DialogDescription>
          </DialogHeader>
          {logs === null ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : logs.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No deployments yet.</p>
          ) : (
            <div className="space-y-2">
              {logs.map((entry) => (
                <div key={entry.id} className="rounded-md border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={entry.status === "success" ? "success" : entry.status === "failed" ? "destructive" : "secondary"}>
                      {entry.action}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(entry.created_at)}
                    </span>
                    {entry.message && <span className="text-xs">{entry.message}</span>}
                  </div>
                  {Array.isArray(entry.logs) && entry.logs.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5 font-mono text-[11px] text-muted-foreground">
                      {(entry.logs as { detail?: string }[]).map((line, i) => (
                        <li key={i}>{line.detail}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
