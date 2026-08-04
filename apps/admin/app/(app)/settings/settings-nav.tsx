"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@aiwebsite/ui";

const TABS = [
  { title: "General", href: "/settings" },
  { title: "API Keys", href: "/settings/api-keys" },
  { title: "AI", href: "/settings/ai" },
  { title: "Prompts", href: "/settings/prompts" },
  { title: "Scoring", href: "/settings/scoring" },
  { title: "Demo slots", href: "/settings/slots" },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Settings sections" className="flex gap-1 border-b">
      {TABS.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
              isActive
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.title}
          </Link>
        );
      })}
    </nav>
  );
}
