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
