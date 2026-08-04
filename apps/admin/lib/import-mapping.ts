/**
 * Column-mapping vocabulary for the bulk lead importer.
 * Shared by the wizard UI (auto-suggestions) and the server action
 * (authoritative mapping) — keep pure, no server imports.
 */

export interface ImportField {
  key: string;
  label: string;
}

export const IMPORT_FIELDS: ImportField[] = [
  { key: "business_name", label: "Business name (required)" },
  { key: "category", label: "Category" },
  { key: "owner_name", label: "Owner name" },
  { key: "phone", label: "Phone" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "email", label: "Email" },
  { key: "website", label: "Website" },
  { key: "instagram", label: "Instagram" },
  { key: "facebook", label: "Facebook" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "google_rating", label: "Google rating" },
  { key: "review_count", label: "Review count" },
  { key: "address", label: "Address" },
  { key: "area", label: "Area / locality" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "country", label: "Country" },
  { key: "pincode", label: "PIN code" },
  { key: "latitude", label: "Latitude" },
  { key: "longitude", label: "Longitude" },
  { key: "google_maps_url", label: "Google Maps URL" },
  { key: "place_id", label: "Place ID" },
  { key: "business_description", label: "Description" },
  { key: "services", label: "Services (comma list)" },
  { key: "notes", label: "Notes" },
  { key: "lead_source", label: "Lead source" },
  { key: "tags", label: "Tags (comma list)" },
  { key: "priority", label: "Priority (high/medium/low)" },
];

export const IMPORT_FIELD_KEYS = IMPORT_FIELDS.map((f) => f.key);

/** normalized header → field key */
const HEADER_ALIASES: Record<string, string> = {
  // business name
  businessname: "business_name", name: "business_name", business: "business_name",
  companyname: "business_name", title: "business_name", storename: "business_name",
  // category
  category: "category", type: "category", businesstype: "category", maincategory: "category",
  // owner
  ownername: "owner_name", owner: "owner_name", contactperson: "owner_name",
  // phone / whatsapp
  phone: "phone", phonenumber: "phone", mobile: "phone", mobilenumber: "phone",
  contact: "phone", contactnumber: "phone", phone1: "phone",
  whatsapp: "whatsapp", whatsappnumber: "whatsapp", wa: "whatsapp",
  // email / web / socials
  email: "email", emailaddress: "email", mail: "email",
  website: "website", websiteurl: "website", site: "website", url: "website", web: "website",
  instagram: "instagram", insta: "instagram", instagramurl: "instagram",
  facebook: "facebook", fb: "facebook", facebookurl: "facebook",
  linkedin: "linkedin", linkedinurl: "linkedin",
  // google data
  rating: "google_rating", googlerating: "google_rating", stars: "google_rating",
  avgrating: "google_rating", totalscore: "google_rating",
  reviews: "review_count", reviewcount: "review_count", reviewscount: "review_count",
  totalreviews: "review_count", userratingstotal: "review_count", reviewsscount: "review_count",
  googlemapsurl: "google_maps_url", mapsurl: "google_maps_url", mapurl: "google_maps_url",
  googlemapslink: "google_maps_url", maplink: "google_maps_url",
  placeid: "place_id", googleplaceid: "place_id",
  // location
  address: "address", fulladdress: "address", street: "address", addressline: "address",
  area: "area", locality: "area", neighborhood: "area", neighbourhood: "area", location: "area",
  city: "city", town: "city",
  state: "state", region: "state",
  country: "country",
  pincode: "pincode", pin: "pincode", zip: "pincode", zipcode: "pincode",
  postalcode: "pincode", postcode: "pincode",
  latitude: "latitude", lat: "latitude",
  longitude: "longitude", lng: "longitude", lon: "longitude", long: "longitude",
  // misc
  description: "business_description", about: "business_description",
  businessdescription: "business_description",
  services: "services", servicelist: "services", categories: "services",
  notes: "notes", note: "notes", remarks: "notes", comment: "notes",
  source: "lead_source", leadsource: "lead_source",
  tags: "tags", labels: "tags",
  priority: "priority",
};

export function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Suggests a mapping for each source column. Unmapped columns default to ""
 * (kept in raw_import only).
 */
export function suggestMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const used = new Set<string>();
  for (const header of headers) {
    const suggestion = HEADER_ALIASES[normalizeHeader(header)] ?? "";
    if (suggestion && !used.has(suggestion)) {
      mapping[header] = suggestion;
      used.add(suggestion);
    } else {
      mapping[header] = "";
    }
  }
  return mapping;
}
