import { z } from "zod";

/** Indian GSTIN, or empty. */
const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const agencyProfileSchema = z.object({
  name: z.string().trim().min(1, "Agency name is required").max(120),
  logo_url: z.string().trim().url("Enter a valid URL (https://…)").or(z.literal("")),
  whatsapp: z
    .string()
    .trim()
    .regex(/^[0-9+\-() ]*$/, "Digits, +, -, ( ) and spaces only")
    .max(20),
  email: z.string().trim().email("Enter a valid email").or(z.literal("")),
  address: z.string().trim().max(500),
  gst_no: z
    .string()
    .trim()
    .toUpperCase()
    .regex(gstRegex, "Enter a valid 15-character GSTIN")
    .or(z.literal("")),
});
export type AgencyProfileInput = z.infer<typeof agencyProfileSchema>;

/** Empty string means "leave unchanged" — only non-empty values are saved. */
export const apiKeysSchema = z.object({
  anthropic_api_key: z.string().trim().max(300),
  gemini_api_key: z.string().trim().max(300),
  openai_compat_base_url: z.string().trim().url("Enter a valid URL").or(z.literal("")),
  openai_compat_api_key: z.string().trim().max(300),
  cloudinary_cloud_name: z.string().trim().max(100),
  cloudinary_api_key: z.string().trim().max(300),
  cloudinary_api_secret: z.string().trim().max(300),
  resend_api_key: z.string().trim().max(300),
  razorpay_key_id: z.string().trim().max(100),
  razorpay_key_secret: z.string().trim().max(300),
  razorpay_webhook_secret: z.string().trim().max(300),
  google_places_api_key: z.string().trim().max(300),
  whatsapp_inbound_webhook_secret: z.string().trim().max(300),
});
export type ApiKeysInput = z.infer<typeof apiKeysSchema>;
