"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Badge, cn, Tooltip, TooltipContent, TooltipTrigger } from "@aiwebsite/ui";

import { NAV_SECTIONS } from "@/lib/nav";

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main navigation" className="flex flex-col gap-4">
      {NAV_SECTIONS.map((section) => (
        <div key={section.label}>
          <p className="mb-1 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {section.label}
          </p>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const isActive =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              const Icon = item.icon;

              if (item.phase !== undefined) {
                return (
                  <li key={item.href}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          aria-disabled="true"
                          className="flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground/60"
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="flex-1">{item.title}</span>
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            P{item.phase}
                          </Badge>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="right">Ships in Phase {item.phase}</TooltipContent>
                    </Tooltip>
                  </li>
                );
              }

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                        : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.title}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
