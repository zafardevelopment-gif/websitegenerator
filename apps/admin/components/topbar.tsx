"use client";

import * as React from "react";
import { Menu, Search } from "lucide-react";

import {
  Button,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@aiwebsite/ui";

import { CommandMenu } from "./command-menu";
import { NotificationsBell } from "./notifications-bell";
import { SidebarNav } from "./sidebar-nav";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu, type UserMenuProps } from "./user-menu";

export function Topbar({ user }: { user: UserMenuProps }) {
  const [commandOpen, setCommandOpen] = React.useState(false);
  const [sheetOpen, setSheetOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Mobile navigation */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="border-b p-4 text-left">
            <SheetTitle className="flex items-center gap-2 text-sm">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
                A
              </span>
              AIVEXA
            </SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto p-3">
            <SidebarNav onNavigate={() => setSheetOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Search / Cmd+K */}
      <Button
        variant="outline"
        className="h-9 w-full max-w-64 justify-start gap-2 text-sm font-normal text-muted-foreground sm:ml-0"
        onClick={() => setCommandOpen(true)}
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Search…</span>
        <kbd className="pointer-events-none ml-auto hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium sm:flex">
          Ctrl K
        </kbd>
      </Button>
      <CommandMenu open={commandOpen} onOpenChange={setCommandOpen} />

      <div className="ml-auto flex items-center gap-1">
        <NotificationsBell />
        <ThemeToggle />
        <UserMenu {...user} />
      </div>
    </header>
  );
}
