-- ═══════════════════════════════════════════════════════════════════
-- 0002_core_schema.sql — Instant Business Website AI (Phase 2)
-- All core tables, enums, indexes and data triggers.
-- Depends on: 0001_foundation.sql (aiwebsite_users, aiwebsite_settings,
--             aiwebsite_set_updated_at, aiwebsite_current_role).
-- ═══════════════════════════════════════════════════════════════════

-- ── Enums ────────────────────────────────────────────────────────────

create type public.aiwebsite_lead_status as enum (
  'new', 'website_generated', 'demo_deployed', 'whatsapp_sent', 'demo_viewed',
  'waiting', 'interested', 'meeting', 'quotation_sent', 'negotiation',
  'won', 'lost'
);

create type public.aiwebsite_priority as enum ('high', 'medium', 'low');

create type public.aiwebsite_activity_type as enum (
  'status_change', 'note', 'message_sent', 'demo_view', 'follow_up',
  'import', 'call', 'meeting', 'quotation', 'payment', 'system'
);

create type public.aiwebsite_import_status as enum (
  'pending', 'processing', 'completed', 'failed'
);

create type public.aiwebsite_site_mode as enum ('demo', 'production');

create type public.aiwebsite_site_status as enum (
  'draft', 'live', 'paused', 'expired', 'archived', 'converted'
);

create type public.aiwebsite_language_mode as enum ('en', 'hi', 'bilingual');

create type public.aiwebsite_deploy_action as enum (
  'publish', 'refresh', 'pause', 'resume', 'expire', 'archive', 'unpublish'
);

create type public.aiwebsite_deploy_status as enum ('pending', 'success', 'failed');

create type public.aiwebsite_media_type as enum (
  'logo', 'hero', 'gallery', 'team', 'certificate', 'video', 'other'
);

create type public.aiwebsite_device_type as enum ('mobile', 'tablet', 'desktop', 'other');

create type public.aiwebsite_event_type as enum (
  'page_view', 'section_view', 'scroll_depth',
  'cta_call', 'cta_whatsapp', 'cta_appointment', 'form_submit', 'outbound_click'
);

create type public.aiwebsite_form_type as enum ('contact', 'appointment');

create type public.aiwebsite_channel as enum ('whatsapp', 'email');

create type public.aiwebsite_message_status as enum (
  'draft', 'sent', 'delivered', 'read', 'opened', 'failed'
);

create type public.aiwebsite_follow_up_status as enum (
  'pending', 'done', 'snoozed', 'cancelled'
);

create type public.aiwebsite_quotation_status as enum (
  'draft', 'sent', 'accepted', 'rejected', 'expired'
);

create type public.aiwebsite_payment_status as enum (
  'created', 'pending', 'paid', 'failed', 'refunded', 'cancelled'
);

create type public.aiwebsite_domain_status as enum (
  'pending_dns', 'verifying', 'active', 'failed', 'removed'
);

create type public.aiwebsite_ai_provider as enum ('anthropic', 'gemini', 'openai_compat');

-- ── Lead imports (referenced by leads) ───────────────────────────────

create table public.aiwebsite_lead_imports (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  column_mapping jsonb not null default '{}'::jsonb,
  status public.aiwebsite_import_status not null default 'pending',
  total_rows integer not null default 0,
  imported_rows integer not null default 0,
  skipped_rows integer not null default 0,
  duplicate_rows integer not null default 0,
  error_report jsonb not null default '[]'::jsonb,
  created_by uuid references public.aiwebsite_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create trigger aiwebsite_lead_imports_updated_at
  before update on public.aiwebsite_lead_imports
  for each row execute function public.aiwebsite_set_updated_at();

-- ── Leads ────────────────────────────────────────────────────────────

create table public.aiwebsite_leads (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  category text,
  owner_name text,
  phone text,
  whatsapp text,
  email text,
  website text,
  instagram text,
  facebook text,
  linkedin text,
  google_rating numeric(2, 1) check (google_rating is null or (google_rating >= 0 and google_rating <= 5)),
  review_count integer check (review_count is null or review_count >= 0),
  address text,
  area text,
  city text,
  state text,
  country text not null default 'India',
  pincode text,
  latitude double precision,
  longitude double precision,
  google_maps_url text,
  place_id text,
  business_description text,
  services jsonb not null default '[]'::jsonb,
  opening_hours jsonb not null default '{}'::jsonb,
  notes text,
  lead_source text,
  tags text[] not null default '{}',
  priority public.aiwebsite_priority not null default 'medium',
  lead_score integer not null default 0 check (lead_score >= 0 and lead_score <= 100),
  status public.aiwebsite_lead_status not null default 'new',
  raw_import jsonb,
  import_id uuid references public.aiwebsite_lead_imports (id) on delete set null,
  assigned_to uuid references public.aiwebsite_users (id) on delete set null,
  last_contacted_at timestamptz,
  next_follow_up timestamptz,
  created_by uuid references public.aiwebsite_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index aiwebsite_leads_status_idx on public.aiwebsite_leads (status) where deleted_at is null;
create index aiwebsite_leads_next_follow_up_idx on public.aiwebsite_leads (next_follow_up) where deleted_at is null;
create index aiwebsite_leads_place_id_idx on public.aiwebsite_leads (place_id) where place_id is not null;
create index aiwebsite_leads_phone_idx on public.aiwebsite_leads (phone) where phone is not null;
create index aiwebsite_leads_city_area_idx on public.aiwebsite_leads (city, area);
create index aiwebsite_leads_category_idx on public.aiwebsite_leads (category);
create index aiwebsite_leads_tags_idx on public.aiwebsite_leads using gin (tags);
create index aiwebsite_leads_score_idx on public.aiwebsite_leads (lead_score desc) where deleted_at is null;

create trigger aiwebsite_leads_updated_at
  before update on public.aiwebsite_leads
  for each row execute function public.aiwebsite_set_updated_at();

-- ── Lead activities (timeline) ───────────────────────────────────────

create table public.aiwebsite_lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.aiwebsite_leads (id) on delete cascade,
  type public.aiwebsite_activity_type not null,
  title text not null,
  detail jsonb not null default '{}'::jsonb,
  actor_id uuid references public.aiwebsite_users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index aiwebsite_lead_activities_lead_idx
  on public.aiwebsite_lead_activities (lead_id, created_at desc);

-- Every lead status transition lands on the timeline automatically,
-- regardless of which code path performed the update.
create or replace function public.aiwebsite_log_lead_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    insert into public.aiwebsite_lead_activities (lead_id, type, title, detail, actor_id)
    values (
      new.id,
      'status_change',
      'Status changed: ' || old.status || ' → ' || new.status,
      jsonb_build_object('from', old.status, 'to', new.status),
      auth.uid()
    );
  end if;
  return new;
end;
$$;

create trigger aiwebsite_leads_log_status_change
  after update on public.aiwebsite_leads
  for each row execute function public.aiwebsite_log_lead_status_change();

-- ── Templates (registry; component code lives in packages/templates) ─

create table public.aiwebsite_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  category text not null,
  description text,
  color_variants jsonb not null default '[]'::jsonb,
  layout_variants jsonb not null default '[]'::jsonb,
  preview_image_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger aiwebsite_templates_updated_at
  before update on public.aiwebsite_templates
  for each row execute function public.aiwebsite_set_updated_at();

-- ── Sites ────────────────────────────────────────────────────────────

create table public.aiwebsite_sites (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.aiwebsite_leads (id) on delete cascade,
  template_id uuid references public.aiwebsite_templates (id) on delete set null,
  slug text not null unique
    check (slug ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$' and char_length(slug) between 3 and 63),
  name text not null,
  mode public.aiwebsite_site_mode not null default 'demo',
  status public.aiwebsite_site_status not null default 'draft',
  language_mode public.aiwebsite_language_mode not null default 'en',
  color_variant text,
  layout_variant text,
  branding jsonb not null default '{}'::jsonb,
  current_version_id uuid,
  noindex boolean not null default true,
  demo_expires_at timestamptz,
  published_at timestamptz,
  archived_at timestamptz,
  converted_at timestamptz,
  created_by uuid references public.aiwebsite_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index aiwebsite_sites_lead_idx on public.aiwebsite_sites (lead_id);
create index aiwebsite_sites_status_idx on public.aiwebsite_sites (status) where deleted_at is null;
create index aiwebsite_sites_expiry_idx on public.aiwebsite_sites (demo_expires_at)
  where status = 'live' and deleted_at is null;

create trigger aiwebsite_sites_updated_at
  before update on public.aiwebsite_sites
  for each row execute function public.aiwebsite_set_updated_at();

-- ── Site versions (full SiteContent snapshots) ───────────────────────

create table public.aiwebsite_site_versions (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.aiwebsite_sites (id) on delete cascade,
  version_no integer not null,
  site_content jsonb not null,
  change_summary text,
  created_by uuid references public.aiwebsite_users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (site_id, version_no)
);

create index aiwebsite_site_versions_site_idx
  on public.aiwebsite_site_versions (site_id, version_no desc);

alter table public.aiwebsite_sites
  add constraint aiwebsite_sites_current_version_fk
  foreign key (current_version_id) references public.aiwebsite_site_versions (id)
  on delete set null;

-- ── Site sections (current editable state per section) ───────────────

create table public.aiwebsite_site_sections (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.aiwebsite_sites (id) on delete cascade,
  section_key text not null,
  content jsonb not null default '{}'::jsonb,
  ai_generated boolean not null default false,
  last_instruction text,
  updated_by uuid references public.aiwebsite_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, section_key)
);

create trigger aiwebsite_site_sections_updated_at
  before update on public.aiwebsite_site_sections
  for each row execute function public.aiwebsite_set_updated_at();

-- ── Deployments (publish/pause/expire events + logs) ─────────────────

create table public.aiwebsite_deployments (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.aiwebsite_sites (id) on delete cascade,
  action public.aiwebsite_deploy_action not null,
  status public.aiwebsite_deploy_status not null default 'pending',
  message text,
  logs jsonb not null default '[]'::jsonb,
  actor_id uuid references public.aiwebsite_users (id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index aiwebsite_deployments_site_idx
  on public.aiwebsite_deployments (site_id, created_at desc);

-- ── Media assets ─────────────────────────────────────────────────────

create table public.aiwebsite_media_assets (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.aiwebsite_leads (id) on delete cascade,
  type public.aiwebsite_media_type not null default 'other',
  file_name text,
  storage_provider text not null default 'cloudinary',
  public_id text,
  url text not null,
  width integer,
  height integer,
  bytes integer,
  format text,
  alt_text text,
  is_stock boolean not null default false,
  created_by uuid references public.aiwebsite_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index aiwebsite_media_assets_lead_idx on public.aiwebsite_media_assets (lead_id);

create trigger aiwebsite_media_assets_updated_at
  before update on public.aiwebsite_media_assets
  for each row execute function public.aiwebsite_set_updated_at();

-- ── Engagement tracking ──────────────────────────────────────────────
-- Rows are inserted ONLY by the service-role ingestion endpoint
-- (Phase 10); no client insert policies exist.

create table public.aiwebsite_site_visits (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.aiwebsite_sites (id) on delete cascade,
  visitor_key text not null,
  device_type public.aiwebsite_device_type not null default 'other',
  user_agent text,
  referrer text,
  path text not null default '/',
  duration_sec integer not null default 0,
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);

create index aiwebsite_site_visits_site_idx
  on public.aiwebsite_site_visits (site_id, created_at desc);
create index aiwebsite_site_visits_visitor_idx
  on public.aiwebsite_site_visits (site_id, visitor_key);

create table public.aiwebsite_site_events (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.aiwebsite_site_visits (id) on delete cascade,
  site_id uuid not null references public.aiwebsite_sites (id) on delete cascade,
  event_type public.aiwebsite_event_type not null,
  section text,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index aiwebsite_site_events_site_idx
  on public.aiwebsite_site_events (site_id, created_at desc);
create index aiwebsite_site_events_visit_idx on public.aiwebsite_site_events (visit_id);

-- ── Form submissions from live sites ─────────────────────────────────

create table public.aiwebsite_form_submissions (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.aiwebsite_sites (id) on delete cascade,
  form_type public.aiwebsite_form_type not null,
  payload jsonb not null,
  contact_name text,
  contact_phone text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index aiwebsite_form_submissions_site_idx
  on public.aiwebsite_form_submissions (site_id, created_at desc);

-- ── Message templates & outreach log ─────────────────────────────────

create table public.aiwebsite_message_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  channel public.aiwebsite_channel not null,
  name text not null,
  subject text,
  body text not null,
  language public.aiwebsite_language_mode not null default 'en',
  version integer not null default 1,
  is_active boolean not null default true,
  created_by uuid references public.aiwebsite_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (key, version)
);

create trigger aiwebsite_message_templates_updated_at
  before update on public.aiwebsite_message_templates
  for each row execute function public.aiwebsite_set_updated_at();

create table public.aiwebsite_messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.aiwebsite_leads (id) on delete cascade,
  site_id uuid references public.aiwebsite_sites (id) on delete set null,
  channel public.aiwebsite_channel not null,
  template_id uuid references public.aiwebsite_message_templates (id) on delete set null,
  subject text,
  body text not null,
  status public.aiwebsite_message_status not null default 'draft',
  external_id text,
  error text,
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  created_by uuid references public.aiwebsite_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index aiwebsite_messages_lead_idx
  on public.aiwebsite_messages (lead_id, created_at desc);

create trigger aiwebsite_messages_updated_at
  before update on public.aiwebsite_messages
  for each row execute function public.aiwebsite_set_updated_at();

-- ── Follow-ups ───────────────────────────────────────────────────────

create table public.aiwebsite_follow_ups (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.aiwebsite_leads (id) on delete cascade,
  due_at timestamptz not null,
  note text,
  status public.aiwebsite_follow_up_status not null default 'pending',
  snoozed_from timestamptz,
  completed_at timestamptz,
  created_by uuid references public.aiwebsite_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index aiwebsite_follow_ups_due_idx on public.aiwebsite_follow_ups (status, due_at);
create index aiwebsite_follow_ups_lead_idx on public.aiwebsite_follow_ups (lead_id);

create trigger aiwebsite_follow_ups_updated_at
  before update on public.aiwebsite_follow_ups
  for each row execute function public.aiwebsite_set_updated_at();

-- ── Quotations & payments ────────────────────────────────────────────

create sequence public.aiwebsite_quote_seq;

create table public.aiwebsite_quotations (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.aiwebsite_leads (id) on delete cascade,
  quote_number text not null unique,
  title text not null default 'Website development',
  status public.aiwebsite_quotation_status not null default 'draft',
  currency text not null default 'INR',
  subtotal numeric(12, 2) not null default 0,
  gst_enabled boolean not null default true,
  gst_rate numeric(4, 2) not null default 18,
  gst_amount numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  valid_until date,
  notes text,
  pdf_url text,
  sent_at timestamptz,
  decided_at timestamptz,
  created_by uuid references public.aiwebsite_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index aiwebsite_quotations_lead_idx on public.aiwebsite_quotations (lead_id);

create trigger aiwebsite_quotations_updated_at
  before update on public.aiwebsite_quotations
  for each row execute function public.aiwebsite_set_updated_at();

-- AXQ-202607-0001 style quote numbers, assigned when the row is created.
-- (BEFORE INSERT triggers run before NOT NULL is checked, so inserts may
-- omit quote_number entirely.)
create or replace function public.aiwebsite_assign_quote_number()
returns trigger
language plpgsql
as $$
begin
  if new.quote_number is null or new.quote_number = '' then
    new.quote_number :=
      'AXQ-' || to_char(now(), 'YYYYMM') || '-' ||
      lpad(nextval('public.aiwebsite_quote_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

create trigger aiwebsite_quotations_assign_number
  before insert on public.aiwebsite_quotations
  for each row execute function public.aiwebsite_assign_quote_number();

create table public.aiwebsite_quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.aiwebsite_quotations (id) on delete cascade,
  description text not null,
  quantity numeric(10, 2) not null default 1,
  unit_price numeric(12, 2) not null,
  amount numeric(12, 2) not null,
  sort_order integer not null default 0
);

create index aiwebsite_quotation_items_quotation_idx
  on public.aiwebsite_quotation_items (quotation_id, sort_order);

create table public.aiwebsite_payments (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.aiwebsite_leads (id) on delete cascade,
  quotation_id uuid references public.aiwebsite_quotations (id) on delete set null,
  provider text not null default 'razorpay',
  razorpay_link_id text,
  razorpay_payment_id text,
  amount numeric(12, 2) not null,
  currency text not null default 'INR',
  status public.aiwebsite_payment_status not null default 'created',
  purpose text,
  paid_at timestamptz,
  webhook_payload jsonb,
  created_by uuid references public.aiwebsite_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index aiwebsite_payments_lead_idx on public.aiwebsite_payments (lead_id);
create index aiwebsite_payments_link_idx on public.aiwebsite_payments (razorpay_link_id)
  where razorpay_link_id is not null;

create trigger aiwebsite_payments_updated_at
  before update on public.aiwebsite_payments
  for each row execute function public.aiwebsite_set_updated_at();

-- ── Clients & custom domains (post-conversion) ───────────────────────

create table public.aiwebsite_clients (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null unique references public.aiwebsite_leads (id) on delete cascade,
  site_id uuid references public.aiwebsite_sites (id) on delete set null,
  business_name text not null,
  onboarding_checklist jsonb not null default '[]'::jsonb,
  domain_expiry date,
  renewal_date date,
  maintenance_notes text,
  hosting_notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger aiwebsite_clients_updated_at
  before update on public.aiwebsite_clients
  for each row execute function public.aiwebsite_set_updated_at();

create table public.aiwebsite_domains (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.aiwebsite_clients (id) on delete set null,
  site_id uuid not null references public.aiwebsite_sites (id) on delete cascade,
  domain text not null unique,
  status public.aiwebsite_domain_status not null default 'pending_dns',
  verification jsonb not null default '{}'::jsonb,
  ssl_active boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index aiwebsite_domains_site_idx on public.aiwebsite_domains (site_id);

create trigger aiwebsite_domains_updated_at
  before update on public.aiwebsite_domains
  for each row execute function public.aiwebsite_set_updated_at();

-- ── AI: prompt templates & usage logs ────────────────────────────────

create table public.aiwebsite_prompt_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  category text,
  name text not null,
  system_prompt text not null,
  user_prompt text,
  tone text,
  version integer not null default 1,
  is_active boolean not null default true,
  parent_id uuid references public.aiwebsite_prompt_templates (id) on delete set null,
  created_by uuid references public.aiwebsite_users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (key, version)
);

create index aiwebsite_prompt_templates_key_idx
  on public.aiwebsite_prompt_templates (key) where is_active;

create table public.aiwebsite_ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  provider public.aiwebsite_ai_provider not null,
  model text not null,
  purpose text not null,
  lead_id uuid references public.aiwebsite_leads (id) on delete set null,
  site_id uuid references public.aiwebsite_sites (id) on delete set null,
  prompt_template_id uuid references public.aiwebsite_prompt_templates (id) on delete set null,
  tokens_in integer not null default 0,
  tokens_out integer not null default 0,
  latency_ms integer not null default 0,
  cost_usd numeric(10, 6) not null default 0,
  cost_inr numeric(10, 4) not null default 0,
  success boolean not null default true,
  error text,
  created_by uuid references public.aiwebsite_users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index aiwebsite_ai_usage_logs_created_idx
  on public.aiwebsite_ai_usage_logs (created_at desc);
create index aiwebsite_ai_usage_logs_lead_idx on public.aiwebsite_ai_usage_logs (lead_id);
