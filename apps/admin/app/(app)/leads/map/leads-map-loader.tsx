"use client";

import dynamic from "next/dynamic";

import type { LeadRow } from "@aiwebsite/db/types";
import { Skeleton } from "@aiwebsite/ui";

// Leaflet touches `window` at import time — client-only, no SSR.
const LeadsMap = dynamic(() => import("./leads-map").then((m) => m.LeadsMap), {
  ssr: false,
  loading: () => <Skeleton className="h-[70vh] w-full rounded-lg" />,
});

export function LeadsMapLoader({ leads }: { leads: LeadRow[] }) {
  return <LeadsMap leads={leads} />;
}
