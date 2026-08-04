import {
  BarChart3,
  CalendarClock,
  Globe,
  Image,
  LayoutDashboard,
  LayoutTemplate,
  MessageSquare,
  Rocket,
  Settings,
  Users,
  Users2,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Phase in which this module ships. Items with a future phase render disabled. */
  phase?: number;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", href: "/", icon: LayoutDashboard }],
  },
  {
    label: "CRM",
    items: [
      { title: "Leads", href: "/leads", icon: Users },
      { title: "Follow-ups", href: "/follow-ups", icon: CalendarClock },
    ],
  },
  {
    label: "Websites",
    items: [
      { title: "Templates", href: "/templates", icon: LayoutTemplate },
      { title: "Generator", href: "/generator", icon: Globe },
      { title: "Media", href: "/media", icon: Image },
      { title: "Deployments", href: "/deployments", icon: Rocket },
    ],
  },
  {
    label: "Growth",
    items: [
      { title: "Outreach", href: "/outreach", icon: MessageSquare },
      { title: "Analytics", href: "/analytics", icon: BarChart3 },
      { title: "Clients", href: "/clients", icon: Users2 },
    ],
  },
  {
    label: "System",
    items: [{ title: "Settings", href: "/settings", icon: Settings }],
  },
];

/** Nav items that are live right now (used by the Cmd+K menu). */
export const ACTIVE_NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items).filter(
  (i) => i.phase === undefined
);
