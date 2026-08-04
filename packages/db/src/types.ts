/**
 * Database types for the `aiwebsite_*` schema (migrations 0001–0004).
 *
 * Hand-maintained in the same structural shape as `supabase gen types
 * typescript` output, so a generated file can replace this one without
 * touching consumers. Row types are the source of truth; Insert/Update
 * are derived: nullable columns and defaulted columns are optional on insert.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// ── Enum unions (mirror Postgres enums) ─────────────────────────────

export type UserRole = "owner" | "admin" | "viewer";

export type LeadStatus =
  | "new"
  | "website_generated"
  | "demo_deployed"
  | "whatsapp_sent"
  | "demo_viewed"
  | "waiting"
  | "interested"
  | "meeting"
  | "quotation_sent"
  | "negotiation"
  | "won"
  | "lost";

export type Priority = "high" | "medium" | "low";

export type ActivityType =
  | "status_change"
  | "note"
  | "message_sent"
  | "message_received"
  | "demo_view"
  | "follow_up"
  | "import"
  | "call"
  | "meeting"
  | "quotation"
  | "payment"
  | "system";

export type ImportStatus = "pending" | "processing" | "completed" | "failed";
export type SiteMode = "demo" | "production";
export type SlotStatus = "free" | "reserved" | "occupied" | "cooldown" | "disabled";
export type SiteStatus = "draft" | "live" | "paused" | "expired" | "archived" | "converted";
export type LanguageMode = "en" | "hi" | "bilingual";
export type DeployAction =
  | "publish"
  | "refresh"
  | "pause"
  | "resume"
  | "expire"
  | "archive"
  | "unpublish";
export type DeployStatus = "pending" | "success" | "failed";
export type MediaType = "logo" | "hero" | "gallery" | "team" | "certificate" | "video" | "other";
export type DeviceType = "mobile" | "tablet" | "desktop" | "other";
export type EventType =
  | "page_view"
  | "section_view"
  | "scroll_depth"
  | "cta_call"
  | "cta_whatsapp"
  | "cta_appointment"
  | "form_submit"
  | "outbound_click";
export type FormType = "contact" | "appointment";
export type Channel = "whatsapp" | "email";
export type MessageStatus = "draft" | "sent" | "delivered" | "read" | "opened" | "failed";
export type FollowUpStatus = "pending" | "done" | "snoozed" | "cancelled";
export type MessageDirection = "outbound" | "inbound";
export type QuotationStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";
export type PaymentStatus = "created" | "pending" | "paid" | "failed" | "refunded" | "cancelled";
export type DomainStatus = "pending_dns" | "verifying" | "active" | "failed" | "removed";
export type AiProvider = "anthropic" | "gemini" | "openai_compat";
export type NotificationType =
  | "demo_first_view"
  | "demo_cta_click"
  | "form_submission"
  | "daily_digest"
  | "renewal_reminder"
  | "demo_expiring_soon"
  | "inbound_reply"
  | "inbound_reply_ambiguous";

// ── Row interfaces ──────────────────────────────────────────────────

export type UserRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type SettingRow = {
  key: string;
  value: Json;
  is_secret: boolean;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export type LeadImportRow = {
  id: string;
  file_name: string;
  column_mapping: Json;
  status: ImportStatus;
  total_rows: number;
  imported_rows: number;
  skipped_rows: number;
  duplicate_rows: number;
  error_report: Json;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export type LeadRow = {
  id: string;
  business_name: string;
  category: string | null;
  owner_name: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  linkedin: string | null;
  google_rating: number | null;
  review_count: number | null;
  address: string | null;
  area: string | null;
  city: string | null;
  state: string | null;
  country: string;
  pincode: string | null;
  latitude: number | null;
  longitude: number | null;
  google_maps_url: string | null;
  place_id: string | null;
  business_description: string | null;
  services: Json;
  opening_hours: Json;
  notes: string | null;
  lead_source: string | null;
  tags: string[];
  priority: Priority;
  lead_score: number;
  status: LeadStatus;
  raw_import: Json | null;
  import_id: string | null;
  assigned_to: string | null;
  last_contacted_at: string | null;
  next_follow_up: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  /** Trigger-maintained E.164 form of `phone` — see migration 0013. */
  phone_e164: string | null;
  /** Trigger-maintained E.164 form of `whatsapp` — see migration 0013. */
  whatsapp_e164: string | null;
  /** First inbound WhatsApp/email reply timestamp. */
  replied_at: string | null;
}

export type LeadActivityRow = {
  id: string;
  lead_id: string;
  type: ActivityType;
  title: string;
  detail: Json;
  actor_id: string | null;
  created_at: string;
}

export type TemplateRow = {
  id: string;
  key: string;
  name: string;
  category: string;
  description: string | null;
  color_variants: Json;
  layout_variants: Json;
  preview_image_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type SiteRow = {
  id: string;
  lead_id: string;
  template_id: string | null;
  slug: string;
  name: string;
  mode: SiteMode;
  status: SiteStatus;
  language_mode: LanguageMode;
  color_variant: string | null;
  layout_variant: string | null;
  branding: Json;
  current_version_id: string | null;
  noindex: boolean;
  demo_expires_at: string | null;
  published_at: string | null;
  archived_at: string | null;
  converted_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  /** Set once a won deal's custom domain verifies — see migration 0015. */
  redirect_to_domain: string | null;
  /** After this passes, the cron releases the demo slot back to the pool. */
  redirect_grace_ends_at: string | null;
}

export type DemoSlotRow = {
  slug: string;
  position: number;
  status: SlotStatus;
  site_id: string | null;
  lead_id: string | null;
  assigned_at: string | null;
  expires_at: string | null;
  cooldown_until: string | null;
  released_at: string | null;
  lease_count: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export type SiteVersionRow = {
  id: string;
  site_id: string;
  version_no: number;
  site_content: Json;
  change_summary: string | null;
  created_by: string | null;
  created_at: string;
}

export type SiteSectionRow = {
  id: string;
  site_id: string;
  section_key: string;
  content: Json;
  ai_generated: boolean;
  last_instruction: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export type DeploymentRow = {
  id: string;
  site_id: string;
  action: DeployAction;
  status: DeployStatus;
  message: string | null;
  logs: Json;
  actor_id: string | null;
  created_at: string;
  completed_at: string | null;
}

export type MediaAssetRow = {
  id: string;
  lead_id: string | null;
  /** Business category for stock-pool assets (is_stock = true). */
  category: string | null;
  type: MediaType;
  file_name: string | null;
  storage_provider: string;
  public_id: string | null;
  url: string;
  width: number | null;
  height: number | null;
  bytes: number | null;
  format: string | null;
  alt_text: string | null;
  is_stock: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type SiteVisitRow = {
  id: string;
  site_id: string;
  visitor_key: string;
  device_type: DeviceType;
  user_agent: string | null;
  referrer: string | null;
  path: string;
  duration_sec: number;
  is_internal: boolean;
  created_at: string;
}

export type SiteEventRow = {
  id: string;
  visit_id: string;
  site_id: string;
  event_type: EventType;
  section: string | null;
  value: Json;
  created_at: string;
}

export type FormSubmissionRow = {
  id: string;
  site_id: string;
  form_type: FormType;
  payload: Json;
  contact_name: string | null;
  contact_phone: string | null;
  is_read: boolean;
  created_at: string;
}

export type MessageTemplateRow = {
  id: string;
  key: string;
  channel: Channel;
  name: string;
  subject: string | null;
  body: string;
  language: LanguageMode;
  version: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type MessageRow = {
  id: string;
  lead_id: string;
  site_id: string | null;
  channel: Channel;
  template_id: string | null;
  subject: string | null;
  body: string;
  status: MessageStatus;
  external_id: string | null;
  error: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  open_token: string;
  pdf_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  direction: MessageDirection;
}

export type FollowUpRow = {
  id: string;
  lead_id: string;
  due_at: string;
  note: string | null;
  status: FollowUpStatus;
  snoozed_from: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type QuotationRow = {
  id: string;
  lead_id: string;
  quote_number: string;
  title: string;
  status: QuotationStatus;
  currency: string;
  subtotal: number;
  gst_enabled: boolean;
  gst_rate: number;
  gst_amount: number;
  total: number;
  valid_until: string | null;
  notes: string | null;
  pdf_url: string | null;
  sent_at: string | null;
  decided_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type QuotationItemRow = {
  id: string;
  quotation_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  sort_order: number;
}

export type PaymentRow = {
  id: string;
  lead_id: string;
  quotation_id: string | null;
  provider: string;
  razorpay_link_id: string | null;
  razorpay_payment_id: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  purpose: string | null;
  paid_at: string | null;
  webhook_payload: Json | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type ClientRow = {
  id: string;
  lead_id: string;
  site_id: string | null;
  business_name: string;
  onboarding_checklist: Json;
  domain_expiry: string | null;
  renewal_date: string | null;
  maintenance_notes: string | null;
  hosting_notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type DomainRow = {
  id: string;
  client_id: string | null;
  site_id: string;
  domain: string;
  status: DomainStatus;
  verification: Json;
  ssl_active: boolean;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export type PromptTemplateRow = {
  id: string;
  key: string;
  category: string | null;
  name: string;
  system_prompt: string;
  user_prompt: string | null;
  tone: string | null;
  version: number;
  is_active: boolean;
  parent_id: string | null;
  created_by: string | null;
  created_at: string;
}

export type AiUsageLogRow = {
  id: string;
  provider: AiProvider;
  model: string;
  purpose: string;
  lead_id: string | null;
  site_id: string | null;
  prompt_template_id: string | null;
  tokens_in: number;
  tokens_out: number;
  latency_ms: number;
  cost_usd: number;
  cost_inr: number;
  success: boolean;
  error: string | null;
  created_by: string | null;
  created_at: string;
}

export type AuditLogRow = {
  id: string;
  table_name: string;
  record_id: string | null;
  action: string;
  old_data: Json | null;
  new_data: Json | null;
  changed_by: string | null;
  created_at: string;
}

export type NotificationRow = {
  id: string;
  type: NotificationType;
  lead_id: string | null;
  site_id: string | null;
  title: string;
  detail: Json;
  is_read: boolean;
  created_at: string;
}

export type HealthScoreRow = {
  id: string;
  site_id: string;
  seo_score: number | null;
  performance_score: number | null;
  accessibility_score: number | null;
  best_practices_score: number | null;
  mobile_score: number | null;
  desktop_score: number | null;
  conversion_score: number | null;
  trust_score: number | null;
  overall_score: number | null;
  ai_audit: Json;
  pdf_url: string | null;
  created_by: string | null;
  created_at: string;
}

// ── Insert/Update derivation ────────────────────────────────────────

type WithOptional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/** Keys whose column type includes null — optional on insert. */
type NullableKeys<T> = { [K in keyof T]-?: null extends T[K] ? K : never }[keyof T];

/**
 * Table definition: `Defaulted` = NOT NULL columns that have a database
 * default (so they may be omitted on insert). Nullable columns are always
 * optional on insert.
 */
type Tbl<R, Defaulted extends keyof R = never> = {
  Row: R;
  Insert: WithOptional<R, Defaulted | NullableKeys<R>>;
  Update: Partial<R>;
  Relationships: [];
};

// ── Database ────────────────────────────────────────────────────────

export interface Database {
  public: {
    Tables: {
      aiwebsite_users: Tbl<UserRow, "role" | "created_at" | "updated_at">;
      aiwebsite_settings: Tbl<SettingRow, "value" | "is_secret" | "created_at" | "updated_at">;
      aiwebsite_lead_imports: Tbl<
        LeadImportRow,
        | "id" | "column_mapping" | "status" | "total_rows" | "imported_rows"
        | "skipped_rows" | "duplicate_rows" | "error_report" | "created_at" | "updated_at"
      >;
      aiwebsite_leads: Tbl<
        LeadRow,
        | "id" | "country" | "services" | "opening_hours" | "tags" | "priority"
        | "lead_score" | "status" | "created_at" | "updated_at"
      >;
      aiwebsite_lead_activities: Tbl<LeadActivityRow, "id" | "detail" | "created_at">;
      aiwebsite_templates: Tbl<
        TemplateRow,
        | "id" | "color_variants" | "layout_variants" | "is_active" | "sort_order"
        | "created_at" | "updated_at"
      >;
      aiwebsite_sites: Tbl<
        SiteRow,
        | "id" | "mode" | "status" | "language_mode" | "branding" | "noindex"
        | "created_at" | "updated_at"
      >;
      aiwebsite_demo_slots: Tbl<
        DemoSlotRow,
        "status" | "lease_count" | "created_at" | "updated_at"
      >;
      aiwebsite_site_versions: Tbl<SiteVersionRow, "id" | "created_at">;
      aiwebsite_site_sections: Tbl<
        SiteSectionRow,
        "id" | "content" | "ai_generated" | "created_at" | "updated_at"
      >;
      aiwebsite_deployments: Tbl<DeploymentRow, "id" | "status" | "logs" | "created_at">;
      aiwebsite_media_assets: Tbl<
        MediaAssetRow,
        "id" | "type" | "storage_provider" | "is_stock" | "created_at" | "updated_at"
      >;
      aiwebsite_site_visits: Tbl<
        SiteVisitRow,
        "id" | "device_type" | "path" | "duration_sec" | "is_internal" | "created_at"
      >;
      aiwebsite_site_events: Tbl<SiteEventRow, "id" | "value" | "created_at">;
      aiwebsite_form_submissions: Tbl<FormSubmissionRow, "id" | "is_read" | "created_at">;
      aiwebsite_message_templates: Tbl<
        MessageTemplateRow,
        "id" | "language" | "version" | "is_active" | "created_at" | "updated_at"
      >;
      aiwebsite_messages: Tbl<
        MessageRow,
        "id" | "status" | "open_token" | "created_at" | "updated_at" | "direction"
      >;
      aiwebsite_follow_ups: Tbl<FollowUpRow, "id" | "status" | "created_at" | "updated_at">;
      aiwebsite_quotations: Tbl<
        QuotationRow,
        | "id" | "quote_number" | "title" | "status" | "currency" | "subtotal"
        | "gst_enabled" | "gst_rate" | "gst_amount" | "total" | "created_at" | "updated_at"
      >;
      aiwebsite_quotation_items: Tbl<QuotationItemRow, "id" | "quantity" | "sort_order">;
      aiwebsite_payments: Tbl<
        PaymentRow,
        "id" | "provider" | "currency" | "status" | "created_at" | "updated_at"
      >;
      aiwebsite_clients: Tbl<
        ClientRow,
        "id" | "onboarding_checklist" | "is_active" | "created_at" | "updated_at"
      >;
      aiwebsite_domains: Tbl<
        DomainRow,
        "id" | "status" | "verification" | "ssl_active" | "created_at" | "updated_at"
      >;
      aiwebsite_prompt_templates: Tbl<
        PromptTemplateRow,
        "id" | "version" | "is_active" | "created_at"
      >;
      aiwebsite_ai_usage_logs: Tbl<
        AiUsageLogRow,
        | "id" | "tokens_in" | "tokens_out" | "latency_ms" | "cost_usd" | "cost_inr"
        | "success" | "created_at"
      >;
      aiwebsite_audit_logs: Tbl<AuditLogRow, "id" | "created_at">;
      aiwebsite_notifications: Tbl<NotificationRow, "id" | "detail" | "is_read" | "created_at">;
      aiwebsite_health_scores: Tbl<HealthScoreRow, "id" | "ai_audit" | "created_at">;
    };
    Views: Record<string, never>;
    Functions: {
      aiwebsite_current_role: { Args: Record<string, never>; Returns: UserRole | null };
      aiwebsite_is_team: { Args: Record<string, never>; Returns: boolean };
      aiwebsite_is_editor: { Args: Record<string, never>; Returns: boolean };
      aiwebsite_claim_demo_slot: {
        Args: {
          p_site_id: string;
          p_lead_id: string | null;
          p_expires_at?: string | null;
          p_preferred_slug?: string | null;
        };
        Returns: DemoSlotRow;
      };
      aiwebsite_release_demo_slot: {
        Args: { p_slug: string; p_cooldown_days?: number; p_note?: string | null };
        Returns: DemoSlotRow;
      };
      aiwebsite_release_demo_slot_for_site: {
        Args: { p_site_id: string; p_cooldown_days?: number; p_note?: string | null };
        Returns: DemoSlotRow | null;
      };
      aiwebsite_sweep_demo_slots: { Args: Record<string, never>; Returns: number };
    };
    Enums: {
      aiwebsite_user_role: UserRole;
      aiwebsite_lead_status: LeadStatus;
      aiwebsite_priority: Priority;
      aiwebsite_activity_type: ActivityType;
      aiwebsite_import_status: ImportStatus;
      aiwebsite_site_mode: SiteMode;
      aiwebsite_site_status: SiteStatus;
      aiwebsite_slot_status: SlotStatus;
      aiwebsite_language_mode: LanguageMode;
      aiwebsite_deploy_action: DeployAction;
      aiwebsite_deploy_status: DeployStatus;
      aiwebsite_media_type: MediaType;
      aiwebsite_device_type: DeviceType;
      aiwebsite_event_type: EventType;
      aiwebsite_form_type: FormType;
      aiwebsite_channel: Channel;
      aiwebsite_message_status: MessageStatus;
      aiwebsite_follow_up_status: FollowUpStatus;
      aiwebsite_quotation_status: QuotationStatus;
      aiwebsite_payment_status: PaymentStatus;
      aiwebsite_domain_status: DomainStatus;
      aiwebsite_ai_provider: AiProvider;
      aiwebsite_notification_type: NotificationType;
    };
    CompositeTypes: Record<string, never>;
  };
}

/** Convenience client type used by all repositories. */
export type DbClient = import("@supabase/supabase-js").SupabaseClient<Database>;
