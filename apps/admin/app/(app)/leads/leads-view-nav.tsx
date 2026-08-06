"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Copy, Kanban, Map, Search, Table2, Upload } from "lucide-react";

import { cn } from "@aiwebsite/ui";

const VIEWS = [
  { title: "Table", href: "/leads", icon: Table2 },
  { title: "Kanban", href: "/leads/kanban", icon: Kanban },
  { title: "Map", href: "/leads/map", icon: Map },
  { title: "Find (Google)", href: "/leads/find", icon: Search },
  { title: "Import", href: "/leads/import", icon: Upload },
  { title: "Duplicates", href: "/leads/duplicates", icon: Copy },
];

export function LeadsViewNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Lead views" className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
      {VIEWS.map((view) => {
        const isActive = pathname === view.href;
        const Icon = view.icon;
        return (
          <Link
            key={view.href}
            href={view.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
              isActive
                ? "bg-background font-medium shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {view.title}
          </Link>
        );
      })}
    </nav>
  );
}
