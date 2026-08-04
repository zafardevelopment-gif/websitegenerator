"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Star } from "lucide-react";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
} from "@aiwebsite/ui";

import { searchLeadsAction, type LeadSearchHit } from "@/lib/actions/leads";

/** Searchable lead picker → /generator/new?leadId=… */
export function NewSitePicker({
  triggerLabel = "New website",
}: {
  triggerLabel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<LeadSearchHit[]>([]);
  const [searching, setSearching] = React.useState(false);

  React.useEffect(() => {
    if (!open || query.trim().length < 2) {
      setHits([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      setHits(await searchLeadsAction(query));
      setSearching(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [query, open]);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus />
        {triggerLabel}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Generate a website</DialogTitle>
            <DialogDescription>Pick the lead this demo is for.</DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              className="pl-8"
              placeholder="Search business name, owner, phone…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {searching && <p className="py-3 text-center text-sm text-muted-foreground">Searching…</p>}
            {!searching && query.trim().length >= 2 && hits.length === 0 && (
              <p className="py-3 text-center text-sm text-muted-foreground">No leads found.</p>
            )}
            {hits.map((hit) => (
              <button
                key={hit.id}
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push(`/generator/new?leadId=${hit.id}`);
                }}
                className="flex w-full items-center justify-between gap-2 rounded-md border p-3 text-left text-sm transition-colors hover:border-primary hover:bg-primary/5"
              >
                <span>
                  <span className="font-medium">{hit.business_name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {[hit.category, hit.area ?? hit.city].filter(Boolean).join(" · ") || "—"}
                  </span>
                </span>
                <Star className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
