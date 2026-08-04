"use client";

import * as React from "react";
import { LogOut, Monitor, Moon, Plus, Sun, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@aiwebsite/ui";

import { signOut } from "@/lib/actions/auth";
import { searchLeadsAction, type LeadSearchHit } from "@/lib/actions/leads";
import { ACTIVE_NAV_ITEMS } from "@/lib/nav";
import { LEAD_STATUS_LABELS } from "@/lib/lead-meta";

export interface CommandMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Cmd+K palette: navigation, theme and account commands plus live lead
 * search (sites & deployments join the index in their phases).
 */
export function CommandMenu({ open, onOpenChange }: CommandMenuProps) {
  const router = useRouter();
  const { setTheme } = useTheme();
  const [, startTransition] = React.useTransition();
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<LeadSearchHit[]>([]);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  // Reset search state whenever the palette closes.
  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setHits([]);
    }
  }, [open]);

  // Debounced server-side lead search.
  React.useEffect(() => {
    if (query.trim().length < 2) {
      setHits([]);
      return;
    }
    const timer = setTimeout(async () => {
      setHits(await searchLeadsAction(query));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const run = React.useCallback(
    (command: () => void) => {
      onOpenChange(false);
      command();
    },
    [onOpenChange]
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search leads or type a command…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {hits.length > 0 && (
          <>
            <CommandGroup heading="Leads">
              {hits.map((hit) => (
                <CommandItem
                  key={hit.id}
                  // Include the raw query so server matches (e.g. by phone)
                  // survive cmdk's client-side filtering.
                  value={`${hit.business_name} ${hit.area ?? ""} ${query}`}
                  onSelect={() => run(() => router.push(`/leads/${hit.id}`))}
                >
                  <Users />
                  <span className="truncate">{hit.business_name}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {[hit.area ?? hit.city, LEAD_STATUS_LABELS[hit.status]]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading="Navigation">
          {ACTIVE_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem key={item.href} onSelect={() => run(() => router.push(item.href))}>
                <Icon />
                {item.title}
              </CommandItem>
            );
          })}
          <CommandItem onSelect={() => run(() => router.push("/leads/new"))}>
            <Plus />
            New lead
          </CommandItem>
          <CommandItem onSelect={() => run(() => router.push("/settings/api-keys"))}>
            API Keys
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Theme">
          <CommandItem onSelect={() => run(() => setTheme("light"))}>
            <Sun />
            Light
          </CommandItem>
          <CommandItem onSelect={() => run(() => setTheme("dark"))}>
            <Moon />
            Dark
          </CommandItem>
          <CommandItem onSelect={() => run(() => setTheme("system"))}>
            <Monitor />
            System
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Account">
          <CommandItem onSelect={() => run(() => startTransition(() => signOut()))}>
            <LogOut />
            Sign out
            <CommandShortcut>⇧Q</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
