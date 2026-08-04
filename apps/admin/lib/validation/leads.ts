import { z } from "zod";

import { BUSINESS_CATEGORIES } from "@aiwebsite/config";

const optionalUrl = z.string().trim().url("Enter a valid URL (https://…)").or(z.literal(""));
const optionalPhone = z
  .string()
  .trim()
  .regex(/^[0-9+\-() ]*$/, "Digits, +, -, ( ) and spaces only")
  .max(20);

/** Form-level schema. Empty strings mean "not provided" and are converted to null in the action. */
export const leadFormSchema = z.object({
  business_name: z.string().trim().min(1, "Business name is required").max(200),
  category: z.enum(BUSINESS_CATEGORIES).or(z.literal("")),
  business_description: z.string().trim().max(2000),
  owner_name: z.string().trim().max(120),
  phone: optionalPhone,
  whatsapp: optionalPhone,
  email: z.string().trim().email("Enter a valid email").or(z.literal("")),
  website: optionalUrl,
  instagram: z.string().trim().max(200),
  facebook: z.string().trim().max(200),
  linkedin: z.string().trim().max(200),
  google_rating: z
    .string()
    .trim()
    .regex(/^([0-4](\.\d)?|5(\.0)?)?$/, "Rating must be between 0 and 5"),
  review_count: z.string().trim().regex(/^\d*$/, "Whole number only"),
  address: z.string().trim().max(500),
  area: z.string().trim().max(120),
  city: z.string().trim().max(120),
  state: z.string().trim().max(120),
  country: z.string().trim().max(120),
  pincode: z.string().trim().regex(/^(\d{6})?$/, "PIN code is 6 digits"),
  google_maps_url: optionalUrl,
  place_id: z.string().trim().max(200),
  services: z.string().trim().max(1000),
  lead_source: z.string().trim().max(120),
  tags: z.string().trim().max(500),
  priority: z.enum(["high", "medium", "low"]),
  next_follow_up: z.string().trim().regex(/^(\d{4}-\d{2}-\d{2})?$/, "Use the date picker"),
  notes: z.string().trim().max(5000),
});
export type LeadFormInput = z.infer<typeof leadFormSchema>;

export const EMPTY_LEAD_FORM: LeadFormInput = {
  business_name: "",
  category: "",
  business_description: "",
  owner_name: "",
  phone: "",
  whatsapp: "",
  email: "",
  website: "",
  instagram: "",
  facebook: "",
  linkedin: "",
  google_rating: "",
  review_count: "",
  address: "",
  area: "",
  city: "",
  state: "",
  country: "India",
  pincode: "",
  google_maps_url: "",
  place_id: "",
  services: "",
  lead_source: "",
  tags: "",
  priority: "medium",
  next_follow_up: "",
  notes: "",
};

export const noteSchema = z.object({
  leadId: z.string().uuid(),
  note: z.string().trim().min(1, "Note cannot be empty").max(5000),
});

export const followUpSchema = z.object({
  leadId: z.string().uuid(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  note: z.string().trim().max(1000),
});
