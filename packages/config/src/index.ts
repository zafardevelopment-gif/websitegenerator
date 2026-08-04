export * from "./scoring";
export * from "./ai";
export * from "./deploy";

export const APP_NAME = "Instant Business Website AI";
export const AGENCY_NAME = "AIVEXA LLP";
export const DEFAULT_BASE_DOMAIN = "aivexallp.com";
export const DEFAULT_DEMO_EXPIRY_DAYS = 14;

/** Internal team roles. Mirrors the Postgres enum `aiwebsite_user_role`. */
export const USER_ROLES = ["owner", "admin", "viewer"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/**
 * Subdomain slugs that can never be assigned to a demo site.
 * Extended at runtime by the `reserved_slugs` setting.
 */
export const RESERVED_SLUGS = [
  "www",
  "app",
  "admin",
  "api",
  "mail",
  "smtp",
  "ftp",
  "staging",
  "dev",
  "test",
  "demo",
  "assets",
  "static",
  "cdn",
  "status",
  "blog",
  "docs",
  "help",
  "support",
  "dashboard",
  "vercel",
  "supabase",
] as const;

/** Business categories supported by the template library (SRS Module 4). */
export const BUSINESS_CATEGORIES = [
  "Dental Clinic",
  "Medical Clinic",
  "Hospital",
  "Pharmacy",
  "Diagnostic Center",
  "Gym",
  "Fitness Studio",
  "Yoga Center",
  "Restaurant",
  "Cafe",
  "Bakery",
  "Salon",
  "Spa",
  "Barber Shop",
  "Lawyer",
  "CA",
  "Architect",
  "Interior Designer",
  "Construction",
  "Furniture",
  "Travel Agency",
  "Hotel",
  "Resort",
  "Real Estate",
  "Car Dealer",
  "Car Service Center",
  "Photography",
  "School",
  "College",
  "Coaching Institute",
  "NGO",
  "Manufacturer",
  "Wholesaler",
  "Retail Store",
  "Electronics",
  "Fashion",
  "Jewellery",
  "General Business",
] as const;
export type BusinessCategory = (typeof BUSINESS_CATEGORIES)[number];

/**
 * Keys of rows in `aiwebsite_settings`. Central registry so repositories,
 * server actions, and UI never disagree on a key string.
 */
export const SETTING_KEYS = {
  agencyProfile: "agency_profile",
  scoringWeights: "scoring_weights",
  aiConfig: "ai_config",
  deployConfig: "deploy_config",
  // AI providers (secret)
  anthropicApiKey: "anthropic_api_key",
  geminiApiKey: "gemini_api_key",
  openaiCompatApiKey: "openai_compat_api_key",
  // AI providers (plain)
  openaiCompatBaseUrl: "openai_compat_base_url",
  // Cloudinary
  cloudinaryCloudName: "cloudinary_cloud_name",
  cloudinaryApiKey: "cloudinary_api_key",
  cloudinaryApiSecret: "cloudinary_api_secret",
  // Email
  resendApiKey: "resend_api_key",
  // Razorpay
  razorpayKeyId: "razorpay_key_id",
  razorpayKeySecret: "razorpay_key_secret",
  razorpayWebhookSecret: "razorpay_webhook_secret",
  pagespeedApiKey: "pagespeed_api_key",
  googlePlacesApiKey: "google_places_api_key",
  // n8n / WhatsApp inbound (Phase 4)
  whatsappInboundWebhookSecret: "whatsapp_inbound_webhook_secret",
} as const;
export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

/** Setting keys whose values are AES-256-GCM encrypted at rest. */
export const SECRET_SETTING_KEYS: readonly SettingKey[] = [
  SETTING_KEYS.anthropicApiKey,
  SETTING_KEYS.geminiApiKey,
  SETTING_KEYS.openaiCompatApiKey,
  SETTING_KEYS.cloudinaryApiKey,
  SETTING_KEYS.cloudinaryApiSecret,
  SETTING_KEYS.resendApiKey,
  SETTING_KEYS.razorpayKeySecret,
  SETTING_KEYS.razorpayWebhookSecret,
  SETTING_KEYS.pagespeedApiKey,
  SETTING_KEYS.googlePlacesApiKey,
  SETTING_KEYS.whatsappInboundWebhookSecret,
] as const;

export function isSecretSettingKey(key: SettingKey): boolean {
  return SECRET_SETTING_KEYS.includes(key);
}

/** business name → subdomain slug candidate ("Smile Dental Care" → "smile-dental-care"). */
export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/g, "");
  return slug.length >= 3 ? slug : `site-${slug}`.replace(/-$/g, "");
}

export function isReservedSlug(slug: string): boolean {
  return (RESERVED_SLUGS as readonly string[]).includes(slug);
}
