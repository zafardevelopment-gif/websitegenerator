"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  Copy,
  FileImage,
  Loader2,
  MapPin,
  Search,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { BUSINESS_CATEGORIES } from "@aiwebsite/config";
import type { MediaAssetRow, MediaType } from "@aiwebsite/db/types";
import { optimizeImage } from "@aiwebsite/templates";
import {
  Badge,
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  NativeSelect,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@aiwebsite/ui";

import {
  deleteMediaAction,
  getUploadTicketAction,
  importGooglePlacePhotosAction,
  listGooglePlacePhotosAction,
  registerMediaAction,
  type GooglePlacePhotoHit,
} from "@/lib/actions/media";
import { searchLeadsAction, type LeadSearchHit } from "@/lib/actions/leads";

export interface MediaAssetView extends MediaAssetRow {
  usage: { id: string; name: string; slug: string }[];
}

const MEDIA_TYPES: MediaType[] = ["logo", "hero", "gallery", "team", "certificate", "video", "other"];

interface UploadItem {
  name: string;
  status: "uploading" | "done" | "error";
  error?: string;
}

export function MediaManager({
  assets,
  view,
  leadId,
  leadName,
  category,
  cloudinaryReady,
}: {
  assets: MediaAssetView[];
  view: "leads" | "stock";
  leadId: string | null;
  leadName: string | null;
  category: string;
  cloudinaryReady: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [uploadType, setUploadType] = React.useState<MediaType>("gallery");
  const [uploads, setUploads] = React.useState<UploadItem[]>([]);
  const [dragOver, setDragOver] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Lead picker
  const [leadQuery, setLeadQuery] = React.useState("");
  const [leadHits, setLeadHits] = React.useState<LeadSearchHit[]>([]);

  // Google Places photo import
  const [googleOpen, setGoogleOpen] = React.useState(false);
  const [googleLoading, setGoogleLoading] = React.useState(false);
  const [googlePhotos, setGooglePhotos] = React.useState<GooglePlacePhotoHit[]>([]);
  const [googleSelected, setGoogleSelected] = React.useState<Set<string>>(new Set());
  const [googleImporting, setGoogleImporting] = React.useState(false);

  React.useEffect(() => {
    if (view !== "leads" || leadQuery.trim().length < 2) {
      setLeadHits([]);
      return;
    }
    const timer = setTimeout(async () => setLeadHits(await searchLeadsAction(leadQuery)), 250);
    return () => clearTimeout(timer);
  }, [leadQuery, view]);

  const setParams = React.useCallback(
    (patch: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "") params.delete(key);
        else params.set(key, value);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const uploadDisabled =
    !cloudinaryReady || (view === "leads" && !leadId);

  async function uploadFiles(files: File[]) {
    if (uploadDisabled) return;
    for (const file of files) {
      if (file.size > 25 * 1024 * 1024) {
        toast.error(`${file.name}: larger than 25 MB`);
        continue;
      }
      setUploads((u) => [...u, { name: file.name, status: "uploading" }]);
      const fail = (error: string) =>
        setUploads((u) =>
          u.map((item) =>
            item.name === file.name && item.status === "uploading"
              ? { ...item, status: "error", error }
              : item
          )
        );

      try {
        const ticket = await getUploadTicketAction({
          leadId: view === "leads" ? leadId : null,
          isStock: view === "stock",
          category: view === "stock" ? category || "General Business" : "",
        });
        if (!ticket.ok || !ticket.data) {
          fail(ticket.ok ? "No ticket" : ticket.error);
          continue;
        }

        const body = new FormData();
        body.append("file", file);
        body.append("api_key", ticket.data.apiKey);
        body.append("timestamp", String(ticket.data.timestamp));
        body.append("signature", ticket.data.signature);
        body.append("folder", ticket.data.folder);

        const response = await fetch(
          `https://api.cloudinary.com/v1_1/${ticket.data.cloudName}/auto/upload`,
          { method: "POST", body }
        );
        const payload = (await response.json()) as {
          public_id?: string;
          secure_url?: string;
          width?: number;
          height?: number;
          bytes?: number;
          format?: string;
          error?: { message?: string };
        };
        if (!response.ok || !payload.public_id || !payload.secure_url) {
          fail(payload.error?.message ?? `Upload failed (HTTP ${response.status})`);
          continue;
        }

        const registered = await registerMediaAction({
          leadId: view === "leads" ? leadId : null,
          isStock: view === "stock",
          category: view === "stock" ? category || "General Business" : "",
          type: uploadType,
          fileName: file.name,
          publicId: payload.public_id,
          url: payload.secure_url,
          width: payload.width ?? null,
          height: payload.height ?? null,
          bytes: payload.bytes ?? null,
          format: payload.format ?? null,
        });
        if (!registered.ok) {
          fail(registered.error);
          continue;
        }

        setUploads((u) =>
          u.map((item) =>
            item.name === file.name && item.status === "uploading"
              ? { ...item, status: "done" }
              : item
          )
        );
      } catch (e) {
        fail(e instanceof Error ? e.message : "Upload failed");
      }
    }
    router.refresh();
  }

  // Paste-from-clipboard support.
  React.useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const files = Array.from(event.clipboardData?.files ?? []);
      if (files.length > 0) {
        event.preventDefault();
        void uploadFiles(files);
      }
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, leadId, category, uploadType, cloudinaryReady]);

  async function openGooglePicker() {
    if (!leadId) return;
    setGoogleOpen(true);
    setGoogleLoading(true);
    setGooglePhotos([]);
    setGoogleSelected(new Set());
    const result = await listGooglePlacePhotosAction(leadId);
    setGoogleLoading(false);
    if (result.ok && result.data) {
      setGooglePhotos(result.data);
    } else if (!result.ok) {
      toast.error(result.error);
      setGoogleOpen(false);
    }
  }

  function toggleGooglePhoto(ref: string) {
    setGoogleSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ref)) next.delete(ref);
      else next.add(ref);
      return next;
    });
  }

  async function importGooglePhotos() {
    if (!leadId || googleSelected.size === 0) return;
    setGoogleImporting(true);
    const result = await importGooglePlacePhotosAction({
      leadId,
      photoReferences: Array.from(googleSelected),
    });
    setGoogleImporting(false);
    if (result.ok) {
      toast.success(result.message);
      setGoogleOpen(false);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  function copyUrl(url: string) {
    void navigator.clipboard.writeText(url);
    toast.success("URL copied — paste it into any image field in the editor.");
  }

  function remove(id: string) {
    void (async () => {
      const result = await deleteMediaAction(id);
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    })();
  }

  return (
    <div className="space-y-4">
      {/* View switch + scope pickers */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {(
            [
              ["leads", "Lead files"],
              ["stock", "Stock library"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setParams({ view: key === "leads" ? null : key, leadId: null, category: null })}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition-colors",
                view === key ? "bg-background font-medium shadow-sm" : "text-muted-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {view === "leads" && (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="w-64 pl-8"
              placeholder={leadName ? `Folder: ${leadName}` : "Pick a lead folder…"}
              value={leadQuery}
              onChange={(e) => setLeadQuery(e.target.value)}
            />
            {leadHits.length > 0 && (
              <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover p-1 shadow-md">
                {leadHits.map((hit) => (
                  <button
                    key={hit.id}
                    type="button"
                    className="block w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                    onClick={() => {
                      setLeadQuery("");
                      setLeadHits([]);
                      setParams({ leadId: hit.id });
                    }}
                  >
                    {hit.business_name}
                    <span className="block text-xs text-muted-foreground">
                      {hit.area ?? hit.city ?? ""}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {view === "leads" && leadId && (
          <Button variant="ghost" size="sm" onClick={() => setParams({ leadId: null })}>
            <X />
            All recent
          </Button>
        )}
        {view === "leads" && leadId && (
          <Button variant="outline" size="sm" onClick={openGooglePicker}>
            <MapPin />
            Import from Google
          </Button>
        )}

        {view === "stock" && (
          <NativeSelect
            aria-label="Stock category"
            className="w-56"
            value={category}
            onChange={(e) => setParams({ category: e.target.value || null })}
          >
            <option value="">All categories</option>
            {BUSINESS_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </NativeSelect>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Label htmlFor="upload-type" className="text-xs text-muted-foreground">
            Upload as
          </Label>
          <NativeSelect
            id="upload-type"
            className="w-32"
            value={uploadType}
            onChange={(e) => setUploadType(e.target.value as MediaType)}
          >
            {MEDIA_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      {/* Upload zone */}
      {!cloudinaryReady ? (
        <div className="rounded-lg border border-warning/50 bg-warning/10 p-4 text-sm">
          Cloudinary isn&apos;t configured yet — add <strong>cloud name</strong>,{" "}
          <strong>API key</strong> and <strong>API secret</strong> in Settings → API Keys to
          enable uploads.
        </div>
      ) : (
        <button
          type="button"
          disabled={uploadDisabled}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void uploadFiles(Array.from(e.dataTransfer.files));
          }}
          className={cn(
            "flex w-full flex-col items-center gap-1.5 rounded-lg border-2 border-dashed p-8 text-muted-foreground transition-colors",
            dragOver && "border-primary bg-primary/5 text-foreground",
            uploadDisabled
              ? "cursor-not-allowed opacity-60"
              : "hover:border-primary hover:text-foreground"
          )}
        >
          <UploadCloud className="h-7 w-7" />
          <span className="text-sm font-medium">
            {view === "leads" && !leadId
              ? "Pick a lead folder first"
              : "Drop files, click to browse, or paste from clipboard (Ctrl+V)"}
          </span>
          <span className="text-xs">
            {view === "stock"
              ? `Stock pool: ${category || "General Business"}`
              : leadName
                ? `Folder: ${leadName}`
                : ""}
          </span>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*,video/mp4"
            className="hidden"
            onChange={(e) => {
              void uploadFiles(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
        </button>
      )}

      {/* Upload progress */}
      {uploads.length > 0 && (
        <div className="space-y-1 text-sm">
          {uploads.slice(-5).map((item, i) => (
            <p key={item.name + i} className="flex items-center gap-2">
              {item.status === "uploading" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {item.status === "done" && <Check className="h-3.5 w-3.5 text-success" />}
              {item.status === "error" && <X className="h-3.5 w-3.5 text-destructive" />}
              <span className="truncate">{item.name}</span>
              {item.error && <span className="text-xs text-destructive">{item.error}</span>}
            </p>
          ))}
        </div>
      )}

      {/* Grid */}
      {assets.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border py-16 text-muted-foreground">
          <FileImage className="h-8 w-8" />
          <p className="text-sm">No assets here yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {assets.map((asset) => (
            <div key={asset.id} className="group overflow-hidden rounded-lg border bg-card">
              <div className="relative aspect-[4/3] bg-muted">
                {asset.format === "mp4" ? (
                  <video src={asset.url} className="h-full w-full object-cover" muted />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={optimizeImage(asset.url, 400)}
                    alt={asset.alt_text ?? asset.file_name ?? "asset"}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                )}
                <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button size="sm" variant="secondary" onClick={() => copyUrl(asset.url)}>
                    <Copy />
                    URL
                  </Button>
                  {asset.usage.length > 0 ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="sm" variant="secondary">
                          Used ×{asset.usage.length}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        In use — {asset.usage.map((s) => s.name).join(", ")}. Delete carefully.
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <Button size="sm" variant="destructive" onClick={() => remove(asset.id)}>
                      <Trash2 />
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-1 p-2">
                <p className="truncate text-xs font-medium">{asset.file_name ?? asset.public_id}</p>
                <div className="flex flex-wrap items-center gap-1">
                  <Badge variant="outline" className="text-[10px]">
                    {asset.type}
                  </Badge>
                  {asset.category && (
                    <Badge variant="secondary" className="text-[10px]">
                      {asset.category}
                    </Badge>
                  )}
                  {asset.usage.length > 0 && (
                    <Badge variant="success" className="text-[10px]">
                      used ×{asset.usage.length}
                    </Badge>
                  )}
                  {asset.bytes !== null && (
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {(asset.bytes / 1024).toFixed(0)} KB
                    </span>
                  )}
                </div>
                {asset.usage.length > 0 && (
                  <button
                    type="button"
                    className="text-left text-[10px] text-destructive underline-offset-2 hover:underline"
                    onClick={() => {
                      if (
                        window.confirm(
                          `This asset is used by: ${asset.usage.map((s) => s.name).join(", ")}. Delete anyway?`
                        )
                      ) {
                        remove(asset.id);
                      }
                    }}
                  >
                    delete (in use)
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={googleOpen} onOpenChange={setGoogleOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import photos from Google</DialogTitle>
            <DialogDescription>
              {leadName ? `Business photos from ${leadName}'s Google listing.` : "Business photos."}{" "}
              Pick the ones worth using — they&apos;ll be copied into this lead&apos;s media folder.
            </DialogDescription>
          </DialogHeader>
          {googleLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading photos…
            </div>
          ) : (
            <>
              <div className="grid max-h-96 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
                {googlePhotos.map((photo) => {
                  const checked = googleSelected.has(photo.photoReference);
                  return (
                    <button
                      key={photo.photoReference}
                      type="button"
                      onClick={() => toggleGooglePhoto(photo.photoReference)}
                      className={cn(
                        "relative aspect-[4/3] overflow-hidden rounded-md border-2 transition-colors",
                        checked ? "border-primary" : "border-transparent hover:border-muted-foreground/30"
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.previewUrl}
                        alt="Google listing photo"
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                      {checked && (
                        <div className="absolute right-1 top-1 rounded-full bg-primary p-1 text-primary-foreground">
                          <Check className="h-3 w-3" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {googleSelected.size} of {googlePhotos.length} selected
                </p>
                <Button
                  onClick={importGooglePhotos}
                  disabled={googleSelected.size === 0 || googleImporting}
                >
                  {googleImporting ? <Loader2 className="animate-spin" /> : <MapPin />}
                  Import {googleSelected.size > 0 ? googleSelected.size : ""} photo
                  {googleSelected.size === 1 ? "" : "s"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
