"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  History,
  Image as ImageIcon,
  Loader2,
  Monitor,
  Palette,
  RefreshCw,
  BarChart3,
  Rocket,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Tablet,
} from "lucide-react";
import { toast } from "sonner";

import {
  SECTION_LABELS,
  SITE_SECTION_KEYS,
  type SiteContent,
  type SiteSectionKey,
} from "@aiwebsite/templates";
import {
  Badge,
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  NativeSelect,
  Textarea,
} from "@aiwebsite/ui";

import {
  cloneSiteAction,
  regenerateSectionAction,
  restoreVersionAction,
  saveVersionAction,
  updateSiteDesignAction,
} from "@/lib/actions/generator";
import { autoFillImagesAction } from "@/lib/actions/media";
import { publishSiteAction } from "@/lib/actions/deploy";
import { demoUrl } from "@/lib/urls";
import { QrDialog } from "@/components/qr-dialog";
import { AnalyticsPanel } from "./analytics-panel";
import { HealthScorePanel } from "./health-score-panel";
import { searchLeadsAction, type LeadSearchHit } from "@/lib/actions/leads";
import { formatDateTime } from "@/lib/format";

import { SectionFields } from "./section-editors";

export interface EditorSite {
  id: string;
  name: string;
  slug: string;
  status: string;
  colorVariant: string | null;
  layoutVariant: string | null;
  branding: Record<string, string>;
  tone: string;
}

export interface EditorTemplateMeta {
  key: string;
  name: string;
  colorVariants: { key: string; label: string; primary: string }[];
  layoutVariants: { key: string; label: string }[];
  fonts: string[];
}

export interface EditorVersion {
  id: string;
  version_no: number;
  change_summary: string | null;
  created_at: string;
  site_content: unknown;
}

type Device = "desktop" | "tablet" | "mobile";
const DEVICE_WIDTHS: Record<Device, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "390px",
};

export function SiteEditor({
  site,
  template,
  initialContent,
  versions,
  currentVersionId,
  sitesUrl,
}: {
  site: EditorSite;
  template: EditorTemplateMeta;
  initialContent: SiteContent;
  versions: EditorVersion[];
  currentVersionId: string | null;
  sitesUrl: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = React.useState<SiteContent>(initialContent);
  const [dirty, setDirty] = React.useState(false);
  const [device, setDevice] = React.useState<Device>("desktop");
  const [previewKey, setPreviewKey] = React.useState(0);
  const [openSection, setOpenSection] = React.useState<SiteSectionKey>("hero");
  const [saving, startSaving] = React.useTransition();

  // Regenerate dialog state
  const [regenKey, setRegenKey] = React.useState<SiteSectionKey | null>(null);
  const [instruction, setInstruction] = React.useState("");
  const [regenerating, startRegenerating] = React.useTransition();

  // Other dialogs
  const [brandingOpen, setBrandingOpen] = React.useState(false);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [cloneOpen, setCloneOpen] = React.useState(false);

  const previewUrl = `${sitesUrl}/preview/site/${site.id}`;

  const onSectionChange = React.useCallback(
    <K extends SiteSectionKey>(key: K, value: SiteContent[K]) => {
      setDraft((d) => ({ ...d, [key]: value }));
      setDirty(true);
    },
    []
  );

  function saveVersion() {
    startSaving(async () => {
      const result = await saveVersionAction({
        siteId: site.id,
        content: draft,
        summary: "Manual edit",
      });
      if (result.ok) {
        toast.success(result.message);
        setDirty(false);
        setPreviewKey((k) => k + 1);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  const [filling, startFilling] = React.useTransition();
  const [publishing, startPublishing] = React.useTransition();
  const [qrOpen, setQrOpen] = React.useState(false);
  const [analyticsOpen, setAnalyticsOpen] = React.useState(false);
  const [healthScoreOpen, setHealthScoreOpen] = React.useState(false);

  function publish() {
    startPublishing(async () => {
      const result = await publishSiteAction(site.id);
      if (result.ok && result.data) {
        toast.success(`Live at ${demoUrl(result.data.slug)}`);
        setQrOpen(true);
        router.refresh();
      } else if (!result.ok) {
        toast.error(result.error);
      }
    });
  }

  function fillImages() {
    startFilling(async () => {
      const result = await autoFillImagesAction({ siteId: site.id, content: draft });
      if (result.ok && result.data) {
        setDraft(result.data.content as unknown as SiteContent);
        setDirty(true);
        toast.success(result.message);
      } else if (!result.ok) {
        toast.error(result.error);
      }
    });
  }

  function regenerate() {
    if (!regenKey) return;
    const key = regenKey;
    startRegenerating(async () => {
      const result = await regenerateSectionAction({
        siteId: site.id,
        sectionKey: key,
        currentSection: draft[key],
        instruction,
        tone: site.tone,
      });
      if (result.ok && result.data) {
        setDraft((d) => ({ ...d, [key]: result.data!.section as SiteContent[typeof key] }));
        setDirty(true);
        setRegenKey(null);
        setInstruction("");
        toast.success(`${SECTION_LABELS[key]} regenerated — review and save.`);
      } else if (!result.ok) {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/generator"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Generator
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">{site.name}</h1>
        <Badge variant="outline" className="font-mono text-[10px]">
          {site.slug}
        </Badge>
        <Badge variant={site.status === "live" ? "success" : "secondary"}>{site.status}</Badge>
        {dirty && (
          <Badge variant="warning" className="animate-pulse">
            unsaved changes
          </Badge>
        )}
        <span className="ml-auto flex flex-wrap items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={fillImages} disabled={filling}>
            {filling ? <Loader2 className="animate-spin" /> : <ImageIcon />}
            Fill images
          </Button>
          <Button variant="outline" size="sm" onClick={() => setBrandingOpen(true)}>
            <Palette />
            Branding
          </Button>
          <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)}>
            <History />
            v{versions[0]?.version_no ?? 1}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAnalyticsOpen(true)}>
            <BarChart3 />
            Analytics
          </Button>
          <Button variant="outline" size="sm" onClick={() => setHealthScoreOpen(true)}>
            <ShieldCheck />
            Health score
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCloneOpen(true)}>
            <Copy />
            Clone
          </Button>
          <Button size="sm" onClick={saveVersion} disabled={saving || !dirty}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />}
            Save version
          </Button>
          <Button
            size="sm"
            variant={site.status === "live" ? "outline" : "default"}
            onClick={publish}
            disabled={publishing}
          >
            {publishing ? <Loader2 className="animate-spin" /> : <Rocket />}
            {site.status === "live" ? "Republish" : "Publish"}
          </Button>
        </span>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        {/* Sections */}
        <div className="space-y-2 xl:col-span-2">
          {SITE_SECTION_KEYS.map((key) => (
            <div key={key} className="rounded-lg border">
              <button
                type="button"
                onClick={() => setOpenSection((s) => (s === key ? openSection : key))}
                className={cn(
                  "flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium",
                  openSection === key && "border-b bg-muted/40"
                )}
              >
                {SECTION_LABELS[key]}
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`Regenerate ${SECTION_LABELS[key]} with AI`}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-primary hover:bg-primary/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRegenKey(key);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation();
                      setRegenKey(key);
                    }
                  }}
                >
                  <Sparkles className="h-3 w-3" />
                  AI
                </span>
              </button>
              {openSection === key && (
                <div className="p-4">
                  <SectionFields sectionKey={key} content={draft} onSectionChange={onSectionChange} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Preview */}
        <div className="xl:col-span-3">
          <div className="sticky top-16 space-y-2">
            <div className="flex items-center gap-1">
              <p className="text-xs text-muted-foreground">
                Preview shows the last <strong>saved</strong> version
              </p>
              <span className="ml-auto flex items-center gap-1">
                {(
                  [
                    ["desktop", Monitor],
                    ["tablet", Tablet],
                    ["mobile", Smartphone],
                  ] as const
                ).map(([key, Icon]) => (
                  <Button
                    key={key}
                    variant={device === key ? "secondary" : "ghost"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label={`${key} preview`}
                    onClick={() => setDevice(key)}
                  >
                    <Icon className="h-4 w-4" />
                  </Button>
                ))}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Reload preview"
                  onClick={() => setPreviewKey((k) => k + 1)}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={previewUrl} target="_blank" rel="noreferrer">
                    <ExternalLink />
                    Open
                  </a>
                </Button>
              </span>
            </div>
            <div className="flex justify-center overflow-x-auto rounded-lg border bg-muted/40 p-2">
              <iframe
                key={previewKey}
                src={previewUrl}
                title="Site preview"
                className="h-[72vh] rounded-md border bg-white shadow-sm transition-[width] duration-300"
                style={{ width: DEVICE_WIDTHS[device], maxWidth: "100%" }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Regenerate dialog */}
      <Dialog open={regenKey !== null} onOpenChange={(open) => !open && setRegenKey(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Regenerate {regenKey ? SECTION_LABELS[regenKey] : ""} with AI
            </DialogTitle>
            <DialogDescription>
              The current section is replaced in your draft — save a version to keep it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="regen-instruction">Optional instruction</Label>
            <Textarea
              id="regen-instruction"
              rows={3}
              placeholder='e.g. "make it more premium", "mention 24×7 emergency service"'
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegenKey(null)} disabled={regenerating}>
              Cancel
            </Button>
            <Button onClick={regenerate} disabled={regenerating}>
              {regenerating ? <Loader2 className="animate-spin" /> : <Sparkles />}
              Regenerate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BrandingDialog
        open={brandingOpen}
        onOpenChange={setBrandingOpen}
        site={site}
        template={template}
        onSaved={() => setPreviewKey((k) => k + 1)}
      />
      <HistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        siteId={site.id}
        versions={versions}
        currentVersionId={currentVersionId}
        previewUrl={previewUrl}
        onRestoreSection={(key, value) => {
          setDraft((d) => ({ ...d, [key]: value as SiteContent[typeof key] }));
          setDirty(true);
          toast.success(`${SECTION_LABELS[key]} restored into draft — save to keep it.`);
        }}
      />
      <CloneDialog open={cloneOpen} onOpenChange={setCloneOpen} siteId={site.id} />
      <QrDialog url={demoUrl(site.slug)} title={site.name} open={qrOpen} onOpenChange={setQrOpen} />
      <AnalyticsPanel siteId={site.id} open={analyticsOpen} onOpenChange={setAnalyticsOpen} />
      <HealthScorePanel siteId={site.id} open={healthScoreOpen} onOpenChange={setHealthScoreOpen} />
      <QrDialog
        url={demoUrl(site.slug)}
        title={site.name}
        open={qrOpen}
        onOpenChange={setQrOpen}
      />
    </div>
  );
}

/* Branding dialog ---------------------------------------------------- */

function BrandingDialog({
  open,
  onOpenChange,
  site,
  template,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  site: EditorSite;
  template: EditorTemplateMeta;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [colorVariant, setColorVariant] = React.useState(
    site.colorVariant ?? template.colorVariants[0]?.key ?? ""
  );
  const [layoutVariant, setLayoutVariant] = React.useState(
    site.layoutVariant ?? template.layoutVariants[0]?.key ?? ""
  );
  const [branding, setBranding] = React.useState({
    primary: site.branding.primary ?? "",
    secondary: site.branding.secondary ?? "",
    accent: site.branding.accent ?? "",
    fontHeading: site.branding.fontHeading ?? "",
    fontBody: site.branding.fontBody ?? "",
  });

  function save() {
    startTransition(async () => {
      const result = await updateSiteDesignAction({
        siteId: site.id,
        colorVariant,
        layoutVariant,
        branding,
      });
      if (result.ok) {
        toast.success(result.message);
        onOpenChange(false);
        onSaved();
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  const colorField = (key: "primary" | "secondary" | "accent", label: string) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} color`}
          value={branding[key] || "#888888"}
          onChange={(e) => setBranding((b) => ({ ...b, [key]: e.target.value }))}
          className="h-9 w-12 cursor-pointer rounded-md border bg-transparent"
        />
        <Input
          placeholder="theme default"
          value={branding[key]}
          onChange={(e) => setBranding((b) => ({ ...b, [key]: e.target.value }))}
        />
        {branding[key] && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setBranding((b) => ({ ...b, [key]: "" }))}
          >
            Reset
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Branding</DialogTitle>
          <DialogDescription>
            Variant colors are WCAG-checked; overrides are applied on top.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Color scheme</Label>
            <div className="flex flex-wrap gap-2">
              {template.colorVariants.map((variant) => (
                <button
                  key={variant.key}
                  type="button"
                  title={variant.label}
                  aria-pressed={colorVariant === variant.key}
                  onClick={() => setColorVariant(variant.key)}
                  className={cn(
                    "h-9 w-9 rounded-full border-2 transition-transform hover:scale-110",
                    colorVariant === variant.key ? "border-foreground" : "border-transparent"
                  )}
                  style={{ backgroundColor: variant.primary }}
                />
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="branding-layout">Layout</Label>
            <NativeSelect
              id="branding-layout"
              value={layoutVariant}
              onChange={(e) => setLayoutVariant(e.target.value)}
            >
              {template.layoutVariants.map((v) => (
                <option key={v.key} value={v.key}>
                  {v.label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Heading font</Label>
              <NativeSelect
                value={branding.fontHeading}
                onChange={(e) => setBranding((b) => ({ ...b, fontHeading: e.target.value }))}
              >
                <option value="">Template default</option>
                {template.fonts.map((font) => (
                  <option key={font} value={font}>
                    {font}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Body font</Label>
              <NativeSelect
                value={branding.fontBody}
                onChange={(e) => setBranding((b) => ({ ...b, fontBody: e.target.value }))}
              >
                <option value="">Template default</option>
                {template.fonts.map((font) => (
                  <option key={font} value={font}>
                    {font}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
          {colorField("primary", "Primary override")}
          {colorField("secondary", "Secondary override")}
          {colorField("accent", "Accent override")}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={isPending}>
            {isPending ? <Loader2 className="animate-spin" /> : <Save />}
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* History dialog ----------------------------------------------------- */

function HistoryDialog({
  open,
  onOpenChange,
  siteId,
  versions,
  currentVersionId,
  previewUrl,
  onRestoreSection,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteId: string;
  versions: EditorVersion[];
  currentVersionId: string | null;
  previewUrl: string;
  onRestoreSection: (key: SiteSectionKey, value: unknown) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [sectionPick, setSectionPick] = React.useState<Record<string, SiteSectionKey>>({});

  function restore(versionId: string) {
    startTransition(async () => {
      const result = await restoreVersionAction({ siteId, versionId });
      if (result.ok) {
        toast.success(result.message);
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Version history</DialogTitle>
          <DialogDescription>
            Every generation and manual save is a snapshot — restore fully or pull one section
            into your draft.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {versions.map((version) => {
            const isCurrent = version.id === currentVersionId;
            const content = version.site_content as Record<string, unknown> | null;
            return (
              <div key={version.id} className="space-y-2 rounded-md border p-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant={isCurrent ? "success" : "outline"}>
                    v{version.version_no}
                    {isCurrent && " · current"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(version.created_at)}
                  </span>
                  <span className="w-full text-xs text-muted-foreground sm:w-auto">
                    {version.change_summary}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button variant="outline" size="sm" asChild>
                    <a href={`${previewUrl}?v=${version.id}`} target="_blank" rel="noreferrer">
                      <Search />
                      Preview
                    </a>
                  </Button>
                  {!isCurrent && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      onClick={() => restore(version.id)}
                    >
                      <RotateCcw />
                      Restore all
                    </Button>
                  )}
                  {content && (
                    <span className="flex items-center gap-1">
                      <NativeSelect
                        aria-label="Section to restore"
                        className="h-8 w-36 text-xs"
                        value={sectionPick[version.id] ?? "hero"}
                        onChange={(e) =>
                          setSectionPick((s) => ({
                            ...s,
                            [version.id]: e.target.value as SiteSectionKey,
                          }))
                        }
                      >
                        {SITE_SECTION_KEYS.map((key) => (
                          <option key={key} value={key}>
                            {SECTION_LABELS[key]}
                          </option>
                        ))}
                      </NativeSelect>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const key = sectionPick[version.id] ?? "hero";
                          onRestoreSection(key, content[key]);
                          onOpenChange(false);
                        }}
                      >
                        Restore section
                      </Button>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* Clone dialog -------------------------------------------------------- */

function CloneDialog({
  open,
  onOpenChange,
  siteId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteId: string;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<LeadSearchHit[]>([]);
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (!open || query.trim().length < 2) {
      setHits([]);
      return;
    }
    const timer = setTimeout(async () => setHits(await searchLeadsAction(query)), 250);
    return () => clearTimeout(timer);
  }, [query, open]);

  function clone(targetLeadId: string) {
    startTransition(async () => {
      const result = await cloneSiteAction({ siteId, targetLeadId });
      if (result.ok && result.data) {
        toast.success(result.message);
        onOpenChange(false);
        router.push(`/generator/${result.data.newSiteId}`);
      } else if (!result.ok) {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Clone to another lead</DialogTitle>
          <DialogDescription>
            Copies design + content, swapping only the business identity (name, contacts, rating,
            socials). Gallery images are cleared.
          </DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          placeholder="Search target lead…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="max-h-60 space-y-1 overflow-y-auto">
          {hits.map((hit) => (
            <button
              key={hit.id}
              type="button"
              disabled={isPending}
              onClick={() => clone(hit.id)}
              className="flex w-full items-center justify-between rounded-md border p-3 text-left text-sm transition-colors hover:border-primary hover:bg-primary/5 disabled:opacity-50"
            >
              <span>
                <span className="font-medium">{hit.business_name}</span>
                <span className="block text-xs text-muted-foreground">
                  {[hit.category, hit.area ?? hit.city].filter(Boolean).join(" · ") || "—"}
                </span>
              </span>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
