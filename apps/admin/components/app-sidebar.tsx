import Link from "next/link";

import { APP_NAME } from "@aiwebsite/config";

import { SidebarNav } from "./sidebar-nav";

export function AppSidebar() {
  return (
    <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            A
          </span>
          <span className="text-sm font-semibold tracking-tight">AIVEXA</span>
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <SidebarNav />
      </div>
      <div className="border-t p-4">
        <p className="text-xs text-muted-foreground">{APP_NAME}</p>
        <p className="text-xs text-muted-foreground/70">Phase 1 · Foundation</p>
      </div>
    </aside>
  );
}
