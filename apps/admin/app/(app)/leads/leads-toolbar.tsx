"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bookmark, BookmarkPlus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { BUSINESS_CATEGORIES } from "@aiwebsite/config";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Label,
  NativeSelect,
} from "@aiwebsite/ui";

import { LEAD_STATUSES, LEAD_STATUS_LABELS, PRIORITIES, PRIORITY_LABELS } from "@/lib/lead-meta";

interface SavedFilter {
  name: string;
  query: string;
}

const STORAGE_KEY = "aiwebsite.leads.savedFilters";

function loadSavedFilters(): SavedFilter[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter(
          (f): f is SavedFilter =>
            typeof f === "object" && f !== null && "name" in f && "query" in f
        )
      : [];
  } catch {
    return [];
  }
}

export function LeadsToolbar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [saved, setSaved] = React.useState<SavedFilter[]>([]);
  const [saveOpen, setSaveOpen] = React.useState(false);
  const [saveName, setSaveName] = React.useState("");
  const [search, setSearch] = React.useState(searchParams.get("q") ?? "");

  React.useEffect(() => {
    setSaved(loadSavedFilters());
  }, []);

  const setParam = React.useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
      params.delete("page"); // filter change resets pagination
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  // Debounced search → URL.
  React.useEffect(() => {
    const current = searchParams.get("q") ?? "";
    if (search === current) return;
    const timer = setTimeout(() => setParam("q", search || null), 350);
    return () => clearTimeout(timer);
  }, [search, searchParams, setParam]);

  const trashView = searchParams.get("view") === "deleted";
  const hasFilters = ["q", "status", "priority", "category", "tag"].some((k) =>
    searchParams.get(k)
  );

  function persist(next: SavedFilter[]) {
    setSaved(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function saveCurrent() {
    const name = saveName.trim();
    if (!name) return;
    const query = searchParams.toString();
    persist([...saved.filter((f) => f.name !== name), { name, query }]);
    setSaveOpen(false);
    setSaveName("");
    toast.success(`Saved filter "${name}".`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full max-w-xs">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, owner, phone, area…"
          className="pl-8"
          aria-label="Search leads"
        />
      </div>

      <NativeSelect
        aria-label="Filter by status"
        className="w-44"
        value={searchParams.get("status") ?? ""}
        onChange={(e) => setParam("status", e.target.value || null)}
      >
        <option value="">All statuses</option>
        {LEAD_STATUSES.map((s) => (
          <option key={s} value={s}>
            {LEAD_STATUS_LABELS[s]}
          </option>
        ))}
      </NativeSelect>

      <NativeSelect
        aria-label="Filter by priority"
        className="w-36"
        value={searchParams.get("priority") ?? ""}
        onChange={(e) => setParam("priority", e.target.value || null)}
      >
        <option value="">All priorities</option>
        {PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {PRIORITY_LABELS[p]}
          </option>
        ))}
      </NativeSelect>

      <NativeSelect
        aria-label="Filter by category"
        className="w-44"
        value={searchParams.get("category") ?? ""}
        onChange={(e) => setParam("category", e.target.value || null)}
      >
        <option value="">All categories</option>
        {BUSINESS_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </NativeSelect>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={() => router.push(pathname)}>
          <X />
          Clear
        </Button>
      )}

      <div className="ml-auto flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Bookmark />
              Saved filters
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Saved filters</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {saved.length === 0 && (
              <p className="px-2 py-2 text-xs text-muted-foreground">
                Nothing saved yet. Apply filters, then save them here.
              </p>
            )}
            {saved.map((f) => (
              <DropdownMenuItem
                key={f.name}
                className="flex items-center justify-between gap-2"
                onSelect={() => router.push(`${pathname}?${f.query}`)}
              >
                <span className="truncate">{f.name}</span>
                <button
                  type="button"
                  aria-label={`Delete saved filter ${f.name}`}
                  className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    persist(saved.filter((x) => x.name !== f.name));
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setSaveOpen(true)}>
              <BookmarkPlus />
              Save current filters…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant={trashView ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setParam("view", trashView ? null : "deleted")}
        >
          <Trash2 />
          {trashView ? "Exit trash" : "Trash"}
        </Button>
      </div>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Save current filters</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="filter-name">Name</Label>
            <Input
              id="filter-name"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder='e.g. "Karol Bagh dentists"'
              onKeyDown={(e) => e.key === "Enter" && saveCurrent()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveCurrent} disabled={!saveName.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
