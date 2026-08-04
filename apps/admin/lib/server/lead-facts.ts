import "server-only";

import type { LeadFacts } from "@aiwebsite/ai";
import type { LeadRow } from "@aiwebsite/db/types";

export function leadToFacts(lead: LeadRow): LeadFacts {
  return {
    businessName: lead.business_name,
    category: lead.category,
    ownerName: lead.owner_name,
    phone: lead.phone,
    whatsapp: lead.whatsapp ?? lead.phone,
    email: lead.email,
    address: lead.address,
    area: lead.area,
    city: lead.city,
    googleRating: lead.google_rating,
    reviewCount: lead.review_count,
    services: Array.isArray(lead.services) ? (lead.services as string[]) : [],
    businessDescription: lead.business_description,
    notes: lead.notes,
  };
}

/**
 * Google Maps links for the generated site — computed here, never by the AI
 * (it's told to leave unknown fields blank rather than invent a location).
 * Uses the free `maps.google.com/maps?...&output=embed` form, which needs no
 * API key, unlike the official Maps Embed API.
 */
export function buildMapUrls(lead: LeadRow): { mapUrl: string; mapEmbedUrl: string } {
  const hasCoords = lead.latitude != null && lead.longitude != null;
  const query = hasCoords
    ? `${lead.latitude},${lead.longitude}`
    : lead.place_id
      ? `place_id:${lead.place_id}`
      : null;

  if (!query) {
    return { mapUrl: lead.google_maps_url ?? "", mapEmbedUrl: "" };
  }

  const mapUrl =
    lead.google_maps_url ??
    (hasCoords
      ? `https://www.google.com/maps?q=${query}`
      : `https://www.google.com/maps/place/?q=${query}`);
  const mapEmbedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=16&output=embed`;

  return { mapUrl, mapEmbedUrl };
}
