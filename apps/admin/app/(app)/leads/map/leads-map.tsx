"use client";

import "leaflet/dist/leaflet.css";

import * as React from "react";
import Link from "next/link";
import { LatLngBounds } from "leaflet";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";

import type { LeadRow, LeadStatus } from "@aiwebsite/db/types";

import { LeadStatusBadge } from "@/components/lead-badges";
import { LEAD_STATUSES, LEAD_STATUS_LABELS } from "@/lib/lead-meta";

/** Marker colors per status (hex — Leaflet paints SVG directly). */
const STATUS_COLORS: Record<LeadStatus, string> = {
  new: "#71717a",
  website_generated: "#0ea5e9",
  demo_deployed: "#8b5cf6",
  whatsapp_sent: "#22c55e",
  demo_viewed: "#f59e0b",
  waiting: "#a1a1aa",
  interested: "#eab308",
  meeting: "#f97316",
  quotation_sent: "#06b6d4",
  negotiation: "#ef4444",
  won: "#16a34a",
  lost: "#991b1b",
};

const DELHI_CENTER: [number, number] = [28.6139, 77.209];

export function LeadsMap({ leads }: { leads: LeadRow[] }) {
  const bounds = React.useMemo(() => {
    if (leads.length === 0) return null;
    const b = new LatLngBounds([]);
    for (const lead of leads) {
      b.extend([lead.latitude as number, lead.longitude as number]);
    }
    return b.pad(0.15);
  }, [leads]);

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border">
        <MapContainer
          center={DELHI_CENTER}
          zoom={11}
          bounds={bounds ?? undefined}
          scrollWheelZoom
          className="h-[70vh] w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {leads.map((lead) => (
            <CircleMarker
              key={lead.id}
              center={[lead.latitude as number, lead.longitude as number]}
              radius={9}
              pathOptions={{
                color: "#ffffff",
                weight: 2,
                fillColor: STATUS_COLORS[lead.status],
                fillOpacity: 0.9,
              }}
            >
              <Popup>
                <div className="space-y-1">
                  <Link
                    href={`/leads/${lead.id}`}
                    className="text-sm font-semibold text-primary hover:underline"
                  >
                    {lead.business_name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {[lead.category, lead.area, lead.city].filter(Boolean).join(" · ")}
                  </p>
                  <LeadStatusBadge status={lead.status} />
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {LEAD_STATUSES.map((status) => (
          <span key={status} className="inline-flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: STATUS_COLORS[status] }}
            />
            {LEAD_STATUS_LABELS[status]}
          </span>
        ))}
      </div>
    </div>
  );
}
