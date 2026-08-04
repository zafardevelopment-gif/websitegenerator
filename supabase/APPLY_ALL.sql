-- ═══════════════════════════════════════════════════════════════════
-- APPLY_ALL.sql — Instant Business Website AI (AIVEXA LLP)
-- SAB KUCH EK FILE MEIN: migrations 0001–0010 + seed (sample data).
-- Kaise chalayen: Supabase Dashboard → SQL Editor → paste → Run.
-- Ek hi baar chalana hai. (Seed section idempotent hai — dobara
-- chalane par duplicate nahi banega.)
-- ═══════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════
-- 0001_foundation.sql — Instant Business Website AI (Phase 1)
-- Tables: aiwebsite_users, aiwebsite_settings
-- Conventions: every table/enum is prefixed aiwebsite_; RLS on everything;
-- updated_at maintained by trigger; soft delete via deleted_at.
-- ═══════════════════════════════════════════════════════════════════

-- ── Enums ────────────────────────────────────────────────────────────

create type public.aiwebsite_user_role as enum ('owner', 'admin', 'viewer');

-- ── Shared trigger: updated_at ───────────────────────────────────────

create or replace function public.aiwebsite_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── aiwebsite_users ──────────────────────────────────────────────────
-- Mirrors auth.users for internal team members. Row is created
-- automatically by trigger when an auth user signs up / is invited.

create table public.aiwebsite_users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role public.aiwebsite_user_role not null default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger aiwebsite_users_set_updated_at
  before update on public.aiwebsite_users
  for each row execute function public.aiwebsite_set_updated_at();

-- Current user's role — SECURITY DEFINER so RLS policies can call it
-- without recursing into aiwebsite_users' own policies.
create or replace function public.aiwebsite_current_role()
returns public.aiwebsite_user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.aiwebsite_users
  where id = auth.uid() and deleted_at is null;
$$;

-- First auth user becomes owner; everyone after that defaults to admin.
create or replace function public.aiwebsite_handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing int;
begin
  select count(*) into v_existing from public.aiwebsite_users;
  insert into public.aiwebsite_users (id, email, role)
  values (
    new.id,
    coalesce(new.email, ''),
    case when v_existing = 0 then 'owner'::public.aiwebsite_user_role
         else 'admin'::public.aiwebsite_user_role end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger aiwebsite_on_auth_user_created
  after insert on auth.users
  for each row execute function public.aiwebsite_handle_new_auth_user();

-- Only owners may change roles (blocks self-escalation through the
-- own-row update policy).
create or replace function public.aiwebsite_guard_role_change()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role
     and public.aiwebsite_current_role() is distinct from 'owner' then
    raise exception 'Only the owner can change user roles';
  end if;
  return new;
end;
$$;

create trigger aiwebsite_users_guard_role_change
  before update on public.aiwebsite_users
  for each row execute function public.aiwebsite_guard_role_change();

alter table public.aiwebsite_users enable row level security;

create policy "team members can view team"
  on public.aiwebsite_users for select
  to authenticated
  using (true);

create policy "users update own profile, owner updates anyone"
  on public.aiwebsite_users for update
  to authenticated
  using (id = auth.uid() or public.aiwebsite_current_role() = 'owner')
  with check (id = auth.uid() or public.aiwebsite_current_role() = 'owner');

create policy "owner can delete users"
  on public.aiwebsite_users for delete
  to authenticated
  using (public.aiwebsite_current_role() = 'owner');

-- No INSERT policy: rows are created only by the auth trigger
-- (SECURITY DEFINER) — clients cannot insert directly.

-- ── aiwebsite_settings ───────────────────────────────────────────────
-- Key-value application settings. Secret values (API keys) are stored
-- AES-256-GCM encrypted by the server before insert; the ciphertext is
-- useless without SETTINGS_ENCRYPTION_KEY, which never touches the DB.

create table public.aiwebsite_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  is_secret boolean not null default false,
  updated_by uuid references public.aiwebsite_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger aiwebsite_settings_set_updated_at
  before update on public.aiwebsite_settings
  for each row execute function public.aiwebsite_set_updated_at();

alter table public.aiwebsite_settings enable row level security;

create policy "team members can read settings"
  on public.aiwebsite_settings for select
  to authenticated
  using (public.aiwebsite_current_role() is not null);

create policy "owner can insert settings"
  on public.aiwebsite_settings for insert
  to authenticated
  with check (public.aiwebsite_current_role() = 'owner');

create policy "owner can update settings"
  on public.aiwebsite_settings for update
  to authenticated
  using (public.aiwebsite_current_role() = 'owner')
  with check (public.aiwebsite_current_role() = 'owner');

create policy "owner can delete settings"
  on public.aiwebsite_settings for delete
  to authenticated
  using (public.aiwebsite_current_role() = 'owner');

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

-- ═══════════════════════════════════════════════════════════════════
-- 0003_rls_policies.sql — Instant Business Website AI (Phase 2)
-- Row Level Security for every core table.
--
-- Pattern: every policy calls ONLY aiwebsite_is_team() (any active team
-- member — read) or aiwebsite_is_editor() (owner/admin — write). Viewers
-- are read-only at the database level. Converting to multi-tenant SaaS
-- later means changing these two functions, not ~90 policies.
--
-- Tracking tables (site_visits, site_events, form_submissions inserts)
-- intentionally have NO authenticated insert policies: public ingestion
-- goes through service-role Route Handlers only (Phase 10).
-- ═══════════════════════════════════════════════════════════════════

-- ── Helpers ──────────────────────────────────────────────────────────

create or replace function public.aiwebsite_is_team()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.aiwebsite_current_role() is not null;
$$;

create or replace function public.aiwebsite_is_editor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.aiwebsite_current_role() in ('owner', 'admin');
$$;

-- ── Standard team/editor policies ────────────────────────────────────
-- Generated one block per table to stay explicit and greppable.

-- aiwebsite_lead_imports
alter table public.aiwebsite_lead_imports enable row level security;
create policy "team read" on public.aiwebsite_lead_imports
  for select to authenticated using (public.aiwebsite_is_team());
create policy "editors insert" on public.aiwebsite_lead_imports
  for insert to authenticated with check (public.aiwebsite_is_editor());
create policy "editors update" on public.aiwebsite_lead_imports
  for update to authenticated
  using (public.aiwebsite_is_editor()) with check (public.aiwebsite_is_editor());
create policy "editors delete" on public.aiwebsite_lead_imports
  for delete to authenticated using (public.aiwebsite_is_editor());

-- aiwebsite_leads
alter table public.aiwebsite_leads enable row level security;
create policy "team read" on public.aiwebsite_leads
  for select to authenticated using (public.aiwebsite_is_team());
create policy "editors insert" on public.aiwebsite_leads
  for insert to authenticated with check (public.aiwebsite_is_editor());
create policy "editors update" on public.aiwebsite_leads
  for update to authenticated
  using (public.aiwebsite_is_editor()) with check (public.aiwebsite_is_editor());
create policy "editors delete" on public.aiwebsite_leads
  for delete to authenticated using (public.aiwebsite_is_editor());

-- aiwebsite_lead_activities (append-only from clients; no update/delete)
alter table public.aiwebsite_lead_activities enable row level security;
create policy "team read" on public.aiwebsite_lead_activities
  for select to authenticated using (public.aiwebsite_is_team());
create policy "editors insert" on public.aiwebsite_lead_activities
  for insert to authenticated with check (public.aiwebsite_is_editor());

-- aiwebsite_templates
alter table public.aiwebsite_templates enable row level security;
create policy "team read" on public.aiwebsite_templates
  for select to authenticated using (public.aiwebsite_is_team());
create policy "editors insert" on public.aiwebsite_templates
  for insert to authenticated with check (public.aiwebsite_is_editor());
create policy "editors update" on public.aiwebsite_templates
  for update to authenticated
  using (public.aiwebsite_is_editor()) with check (public.aiwebsite_is_editor());
create policy "editors delete" on public.aiwebsite_templates
  for delete to authenticated using (public.aiwebsite_is_editor());

-- aiwebsite_sites
alter table public.aiwebsite_sites enable row level security;
create policy "team read" on public.aiwebsite_sites
  for select to authenticated using (public.aiwebsite_is_team());
create policy "editors insert" on public.aiwebsite_sites
  for insert to authenticated with check (public.aiwebsite_is_editor());
create policy "editors update" on public.aiwebsite_sites
  for update to authenticated
  using (public.aiwebsite_is_editor()) with check (public.aiwebsite_is_editor());
create policy "editors delete" on public.aiwebsite_sites
  for delete to authenticated using (public.aiwebsite_is_editor());

-- aiwebsite_site_versions (immutable snapshots; no update/delete)
alter table public.aiwebsite_site_versions enable row level security;
create policy "team read" on public.aiwebsite_site_versions
  for select to authenticated using (public.aiwebsite_is_team());
create policy "editors insert" on public.aiwebsite_site_versions
  for insert to authenticated with check (public.aiwebsite_is_editor());

-- aiwebsite_site_sections
alter table public.aiwebsite_site_sections enable row level security;
create policy "team read" on public.aiwebsite_site_sections
  for select to authenticated using (public.aiwebsite_is_team());
create policy "editors insert" on public.aiwebsite_site_sections
  for insert to authenticated with check (public.aiwebsite_is_editor());
create policy "editors update" on public.aiwebsite_site_sections
  for update to authenticated
  using (public.aiwebsite_is_editor()) with check (public.aiwebsite_is_editor());
create policy "editors delete" on public.aiwebsite_site_sections
  for delete to authenticated using (public.aiwebsite_is_editor());

-- aiwebsite_deployments (append + status update; no delete — audit trail)
alter table public.aiwebsite_deployments enable row level security;
create policy "team read" on public.aiwebsite_deployments
  for select to authenticated using (public.aiwebsite_is_team());
create policy "editors insert" on public.aiwebsite_deployments
  for insert to authenticated with check (public.aiwebsite_is_editor());
create policy "editors update" on public.aiwebsite_deployments
  for update to authenticated
  using (public.aiwebsite_is_editor()) with check (public.aiwebsite_is_editor());

-- aiwebsite_media_assets
alter table public.aiwebsite_media_assets enable row level security;
create policy "team read" on public.aiwebsite_media_assets
  for select to authenticated using (public.aiwebsite_is_team());
create policy "editors insert" on public.aiwebsite_media_assets
  for insert to authenticated with check (public.aiwebsite_is_editor());
create policy "editors update" on public.aiwebsite_media_assets
  for update to authenticated
  using (public.aiwebsite_is_editor()) with check (public.aiwebsite_is_editor());
create policy "editors delete" on public.aiwebsite_media_assets
  for delete to authenticated using (public.aiwebsite_is_editor());

-- aiwebsite_site_visits (read-only for team; inserts via service role only)
alter table public.aiwebsite_site_visits enable row level security;
create policy "team read" on public.aiwebsite_site_visits
  for select to authenticated using (public.aiwebsite_is_team());

-- aiwebsite_site_events (read-only for team; inserts via service role only)
alter table public.aiwebsite_site_events enable row level security;
create policy "team read" on public.aiwebsite_site_events
  for select to authenticated using (public.aiwebsite_is_team());

-- aiwebsite_form_submissions (inserts via service role; team may mark read)
alter table public.aiwebsite_form_submissions enable row level security;
create policy "team read" on public.aiwebsite_form_submissions
  for select to authenticated using (public.aiwebsite_is_team());
create policy "editors update" on public.aiwebsite_form_submissions
  for update to authenticated
  using (public.aiwebsite_is_editor()) with check (public.aiwebsite_is_editor());

-- aiwebsite_message_templates
alter table public.aiwebsite_message_templates enable row level security;
create policy "team read" on public.aiwebsite_message_templates
  for select to authenticated using (public.aiwebsite_is_team());
create policy "editors insert" on public.aiwebsite_message_templates
  for insert to authenticated with check (public.aiwebsite_is_editor());
create policy "editors update" on public.aiwebsite_message_templates
  for update to authenticated
  using (public.aiwebsite_is_editor()) with check (public.aiwebsite_is_editor());
create policy "editors delete" on public.aiwebsite_message_templates
  for delete to authenticated using (public.aiwebsite_is_editor());

-- aiwebsite_messages
alter table public.aiwebsite_messages enable row level security;
create policy "team read" on public.aiwebsite_messages
  for select to authenticated using (public.aiwebsite_is_team());
create policy "editors insert" on public.aiwebsite_messages
  for insert to authenticated with check (public.aiwebsite_is_editor());
create policy "editors update" on public.aiwebsite_messages
  for update to authenticated
  using (public.aiwebsite_is_editor()) with check (public.aiwebsite_is_editor());

-- aiwebsite_follow_ups
alter table public.aiwebsite_follow_ups enable row level security;
create policy "team read" on public.aiwebsite_follow_ups
  for select to authenticated using (public.aiwebsite_is_team());
create policy "editors insert" on public.aiwebsite_follow_ups
  for insert to authenticated with check (public.aiwebsite_is_editor());
create policy "editors update" on public.aiwebsite_follow_ups
  for update to authenticated
  using (public.aiwebsite_is_editor()) with check (public.aiwebsite_is_editor());
create policy "editors delete" on public.aiwebsite_follow_ups
  for delete to authenticated using (public.aiwebsite_is_editor());

-- aiwebsite_quotations
alter table public.aiwebsite_quotations enable row level security;
create policy "team read" on public.aiwebsite_quotations
  for select to authenticated using (public.aiwebsite_is_team());
create policy "editors insert" on public.aiwebsite_quotations
  for insert to authenticated with check (public.aiwebsite_is_editor());
create policy "editors update" on public.aiwebsite_quotations
  for update to authenticated
  using (public.aiwebsite_is_editor()) with check (public.aiwebsite_is_editor());
create policy "editors delete" on public.aiwebsite_quotations
  for delete to authenticated using (public.aiwebsite_is_editor());

-- aiwebsite_quotation_items
alter table public.aiwebsite_quotation_items enable row level security;
create policy "team read" on public.aiwebsite_quotation_items
  for select to authenticated using (public.aiwebsite_is_team());
create policy "editors insert" on public.aiwebsite_quotation_items
  for insert to authenticated with check (public.aiwebsite_is_editor());
create policy "editors update" on public.aiwebsite_quotation_items
  for update to authenticated
  using (public.aiwebsite_is_editor()) with check (public.aiwebsite_is_editor());
create policy "editors delete" on public.aiwebsite_quotation_items
  for delete to authenticated using (public.aiwebsite_is_editor());

-- aiwebsite_payments (no delete — financial audit trail)
alter table public.aiwebsite_payments enable row level security;
create policy "team read" on public.aiwebsite_payments
  for select to authenticated using (public.aiwebsite_is_team());
create policy "editors insert" on public.aiwebsite_payments
  for insert to authenticated with check (public.aiwebsite_is_editor());
create policy "editors update" on public.aiwebsite_payments
  for update to authenticated
  using (public.aiwebsite_is_editor()) with check (public.aiwebsite_is_editor());

-- aiwebsite_clients
alter table public.aiwebsite_clients enable row level security;
create policy "team read" on public.aiwebsite_clients
  for select to authenticated using (public.aiwebsite_is_team());
create policy "editors insert" on public.aiwebsite_clients
  for insert to authenticated with check (public.aiwebsite_is_editor());
create policy "editors update" on public.aiwebsite_clients
  for update to authenticated
  using (public.aiwebsite_is_editor()) with check (public.aiwebsite_is_editor());
create policy "editors delete" on public.aiwebsite_clients
  for delete to authenticated using (public.aiwebsite_is_editor());

-- aiwebsite_domains
alter table public.aiwebsite_domains enable row level security;
create policy "team read" on public.aiwebsite_domains
  for select to authenticated using (public.aiwebsite_is_team());
create policy "editors insert" on public.aiwebsite_domains
  for insert to authenticated with check (public.aiwebsite_is_editor());
create policy "editors update" on public.aiwebsite_domains
  for update to authenticated
  using (public.aiwebsite_is_editor()) with check (public.aiwebsite_is_editor());
create policy "editors delete" on public.aiwebsite_domains
  for delete to authenticated using (public.aiwebsite_is_editor());

-- aiwebsite_prompt_templates (versioned; no delete, deactivate instead)
alter table public.aiwebsite_prompt_templates enable row level security;
create policy "team read" on public.aiwebsite_prompt_templates
  for select to authenticated using (public.aiwebsite_is_team());
create policy "editors insert" on public.aiwebsite_prompt_templates
  for insert to authenticated with check (public.aiwebsite_is_editor());
create policy "editors update" on public.aiwebsite_prompt_templates
  for update to authenticated
  using (public.aiwebsite_is_editor()) with check (public.aiwebsite_is_editor());

-- aiwebsite_ai_usage_logs (append-only)
alter table public.aiwebsite_ai_usage_logs enable row level security;
create policy "team read" on public.aiwebsite_ai_usage_logs
  for select to authenticated using (public.aiwebsite_is_team());
create policy "editors insert" on public.aiwebsite_ai_usage_logs
  for insert to authenticated with check (public.aiwebsite_is_editor());

-- ═══════════════════════════════════════════════════════════════════
-- 0004_audit.sql — Instant Business Website AI (Phase 2)
-- Generic audit logging: before/after JSON of every mutation on
-- business-critical tables, with the acting user.
-- ═══════════════════════════════════════════════════════════════════

create table public.aiwebsite_audit_logs (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id text,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb,
  changed_by uuid,
  created_at timestamptz not null default now()
);

create index aiwebsite_audit_logs_table_idx
  on public.aiwebsite_audit_logs (table_name, created_at desc);
create index aiwebsite_audit_logs_record_idx
  on public.aiwebsite_audit_logs (record_id);

-- Read: owner/admin only. No write policies — rows are created solely by
-- the SECURITY DEFINER trigger below.
alter table public.aiwebsite_audit_logs enable row level security;
create policy "editors read audit log" on public.aiwebsite_audit_logs
  for select to authenticated using (public.aiwebsite_is_editor());

create or replace function public.aiwebsite_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record_id text;
begin
  if tg_op = 'INSERT' then
    v_record_id := to_jsonb(new) ->> 'id';
    if v_record_id is null then v_record_id := to_jsonb(new) ->> 'key'; end if;
    insert into public.aiwebsite_audit_logs (table_name, record_id, action, new_data, changed_by)
    values (tg_table_name, v_record_id, 'INSERT', to_jsonb(new), auth.uid());
    return new;
  elsif tg_op = 'UPDATE' then
    v_record_id := to_jsonb(new) ->> 'id';
    if v_record_id is null then v_record_id := to_jsonb(new) ->> 'key'; end if;
    insert into public.aiwebsite_audit_logs (table_name, record_id, action, old_data, new_data, changed_by)
    values (tg_table_name, v_record_id, 'UPDATE', to_jsonb(old), to_jsonb(new), auth.uid());
    return new;
  else
    v_record_id := to_jsonb(old) ->> 'id';
    if v_record_id is null then v_record_id := to_jsonb(old) ->> 'key'; end if;
    insert into public.aiwebsite_audit_logs (table_name, record_id, action, old_data, changed_by)
    values (tg_table_name, v_record_id, 'DELETE', to_jsonb(old), auth.uid());
    return old;
  end if;
end;
$$;

-- Attach to business-critical tables.
create trigger aiwebsite_audit_leads
  after insert or update or delete on public.aiwebsite_leads
  for each row execute function public.aiwebsite_audit();

create trigger aiwebsite_audit_sites
  after insert or update or delete on public.aiwebsite_sites
  for each row execute function public.aiwebsite_audit();

create trigger aiwebsite_audit_settings
  after insert or update or delete on public.aiwebsite_settings
  for each row execute function public.aiwebsite_audit();

create trigger aiwebsite_audit_quotations
  after insert or update or delete on public.aiwebsite_quotations
  for each row execute function public.aiwebsite_audit();

create trigger aiwebsite_audit_payments
  after insert or update or delete on public.aiwebsite_payments
  for each row execute function public.aiwebsite_audit();

create trigger aiwebsite_audit_clients
  after insert or update or delete on public.aiwebsite_clients
  for each row execute function public.aiwebsite_audit();

create trigger aiwebsite_audit_domains
  after insert or update or delete on public.aiwebsite_domains
  for each row execute function public.aiwebsite_audit();

-- ═══════════════════════════════════════════════════════════════════
-- 0005_media_category.sql — Instant Business Website AI (Phase 8)
-- Stock image pools are organized by business category.
-- ═══════════════════════════════════════════════════════════════════

alter table public.aiwebsite_media_assets
  add column if not exists category text;

create index if not exists aiwebsite_media_assets_stock_idx
  on public.aiwebsite_media_assets (is_stock, category)
  where deleted_at is null;

-- ═══════════════════════════════════════════════════════════════════
-- 0006_notifications.sql — Instant Business Website AI (Phase 10)
-- In-app notifications: first demo view, CTA clicks. Team-wide inbox
-- (any team member can mark read); rows are created only by the
-- service-role tracking ingest endpoint.
-- ═══════════════════════════════════════════════════════════════════

create type public.aiwebsite_notification_type as enum (
  'demo_first_view', 'demo_cta_click', 'form_submission'
);

create table public.aiwebsite_notifications (
  id uuid primary key default gen_random_uuid(),
  type public.aiwebsite_notification_type not null,
  lead_id uuid references public.aiwebsite_leads (id) on delete cascade,
  site_id uuid references public.aiwebsite_sites (id) on delete cascade,
  title text not null,
  detail jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index aiwebsite_notifications_unread_idx
  on public.aiwebsite_notifications (is_read, created_at desc);
create index aiwebsite_notifications_site_idx
  on public.aiwebsite_notifications (site_id, type);

alter table public.aiwebsite_notifications enable row level security;

create policy "team read" on public.aiwebsite_notifications
  for select to authenticated using (public.aiwebsite_is_team());

-- Any team member can mark notifications read (shared inbox).
create policy "team update" on public.aiwebsite_notifications
  for update to authenticated
  using (public.aiwebsite_is_team()) with check (public.aiwebsite_is_team());

-- No insert policy: rows are created only by the service-role tracking
-- ingest endpoint (Phase 10), same pattern as site_visits/site_events.

-- ═══════════════════════════════════════════════════════════════════
-- 0007_outreach.sql — Instant Business Website AI (Phase 11)
-- Email open-tracking token + PDF proposal storage on messages.
-- ═══════════════════════════════════════════════════════════════════

alter table public.aiwebsite_messages
  add column if not exists open_token uuid not null default gen_random_uuid(),
  add column if not exists pdf_url text;

create unique index if not exists aiwebsite_messages_open_token_idx
  on public.aiwebsite_messages (open_token);

-- ═══════════════════════════════════════════════════════════════════
-- 0008_digest.sql — Instant Business Website AI (Phase 12)
-- Daily digest notification type + a covering index for the follow-up
-- dashboard's due/overdue queries.
-- ═══════════════════════════════════════════════════════════════════

alter type public.aiwebsite_notification_type add value if not exists 'daily_digest';

-- Speeds up "pending, due before X" scans used by the follow-up dashboard
-- and the digest cron (aiwebsite_follow_ups_due_idx from 0002 already
-- covers (status, due_at); this adds the lead join path).
create index if not exists aiwebsite_follow_ups_lead_status_idx
  on public.aiwebsite_follow_ups (lead_id, status);

-- ═══════════════════════════════════════════════════════════════════
-- 0009_health_scores.sql — Instant Business Website AI (Phase 13)
-- Website Health Score & AI Audit history — one row per audit run so
-- scores can be tracked over time (re-run on redeploy).
-- ═══════════════════════════════════════════════════════════════════

create table public.aiwebsite_health_scores (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.aiwebsite_sites (id) on delete cascade,
  seo_score integer check (seo_score between 0 and 100),
  performance_score integer check (performance_score between 0 and 100),
  accessibility_score integer check (accessibility_score between 0 and 100),
  best_practices_score integer check (best_practices_score between 0 and 100),
  mobile_score integer check (mobile_score between 0 and 100),
  desktop_score integer check (desktop_score between 0 and 100),
  conversion_score integer check (conversion_score between 0 and 100),
  trust_score integer check (trust_score between 0 and 100),
  overall_score integer check (overall_score between 0 and 100),
  ai_audit jsonb not null default '{}'::jsonb,
  pdf_url text,
  created_by uuid references public.aiwebsite_users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index aiwebsite_health_scores_site_idx
  on public.aiwebsite_health_scores (site_id, created_at desc);

alter table public.aiwebsite_health_scores enable row level security;

create policy "team read" on public.aiwebsite_health_scores
  for select to authenticated using (public.aiwebsite_is_team());
create policy "editors insert" on public.aiwebsite_health_scores
  for insert to authenticated with check (public.aiwebsite_is_editor());

-- ═══════════════════════════════════════════════════════════════════
-- 0010_conversion.sql — Instant Business Website AI (Phase 14)
-- New notification type for client renewal reminders (domain/hosting
-- expiry). Quotations/payments/clients/domains tables already exist
-- from 0002_core_schema.sql — this migration only adds the enum value
-- the renewal-reminder cron needs.
-- ═══════════════════════════════════════════════════════════════════

alter type public.aiwebsite_notification_type add value if not exists 'renewal_reminder';

-- ═══════════════════════════════════════════════════════════════════
-- SEED — sample data (5 leads, templates, 1 demo site, prompts,
-- WhatsApp templates). Agar sample data nahi chahiye to yahan se
-- neeche ka hissa delete kar dein.
-- ═══════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════
-- seed.sql — sample data for development & manual testing (Phase 2)
-- Safe to run once after migrations 0001–0004. Idempotent-ish: uses
-- fixed UUIDs and ON CONFLICT DO NOTHING so re-running doesn't duplicate.
-- ═══════════════════════════════════════════════════════════════════

-- ── Template registry (component code ships in Phase 5) ─────────────

insert into public.aiwebsite_templates (id, key, name, category, description, color_variants, layout_variants, sort_order)
values
  ('11111111-1111-4111-8111-111111111101', 'dental',     'Bright Smile',   'Dental Clinic',    'Clean medical look with appointment-first hero.',            '["mint","sky","royal","coral"]', '["classic","split-hero"]', 1),
  ('11111111-1111-4111-8111-111111111102', 'restaurant', 'Tandoor Table',  'Restaurant',       'Appetite-driven imagery, menu highlights, reservations.',    '["ember","olive","charcoal"]',   '["classic","gallery-first"]', 2),
  ('11111111-1111-4111-8111-111111111103', 'salon',      'Velvet Chair',   'Salon',            'Elegant beauty aesthetic with services and price list.',     '["blush","noir","lavender"]',    '["classic","split-hero"]', 3),
  ('11111111-1111-4111-8111-111111111104', 'gym',        'Iron Pulse',     'Gym',              'High-energy dark theme with programs and trainers.',         '["volt","crimson","steel"]',     '["classic","stats-first"]', 4),
  ('11111111-1111-4111-8111-111111111105', 'general',    'Local Pro',      'General Business', 'Versatile professional layout for any local business.',      '["indigo","teal","amber","slate"]', '["classic","compact"]', 5)
on conflict (key) do nothing;

-- ── Sample leads (Delhi NCR, varied categories & pipeline stages) ────

insert into public.aiwebsite_leads
  (id, business_name, category, owner_name, phone, whatsapp, google_rating, review_count,
   address, area, city, state, pincode, services, priority, lead_score, status, lead_source, tags)
values
  ('22222222-2222-4222-8222-222222222201', 'Smile Dental Care', 'Dental Clinic', 'Dr. Anjali Mehra',
   '+919810000001', '+919810000001', 4.7, 312,
   '12 Ajmal Khan Road', 'Karol Bagh', 'New Delhi', 'Delhi', '110005',
   '["Root Canal", "Implants", "Braces", "Teeth Whitening"]', 'high', 86, 'demo_deployed',
   'google_maps', '{dentist,karol-bagh,no-website}'),
  ('22222222-2222-4222-8222-222222222202', 'Tandoori Nights', 'Restaurant', 'Rakesh Chawla',
   '+919810000002', '+919810000002', 4.3, 1240,
   'M-Block Market', 'Greater Kailash', 'New Delhi', 'Delhi', '110048',
   '["North Indian", "Mughlai", "Catering"]', 'medium', 72, 'new',
   'google_maps', '{restaurant,gk}'),
  ('22222222-2222-4222-8222-222222222203', 'Glow & Grace Salon', 'Salon', 'Pooja Arora',
   '+919810000003', '+919810000003', 4.8, 189,
   'DLF Phase 4', 'Sector 28', 'Gurugram', 'Haryana', '122002',
   '["Hair", "Makeup", "Bridal", "Skin Care"]', 'high', 81, 'whatsapp_sent',
   'instagram', '{salon,gurugram,no-website}'),
  ('22222222-2222-4222-8222-222222222204', 'Iron Temple Gym', 'Gym', 'Vikram Singh',
   '+919810000004', '+919810000004', 4.5, 267,
   'Sector 18 Market', 'Sector 18', 'Noida', 'Uttar Pradesh', '201301',
   '["Strength Training", "CrossFit", "Personal Training", "Zumba"]', 'medium', 68, 'new',
   'google_maps', '{gym,noida}'),
  ('22222222-2222-4222-8222-222222222205', 'Kapoor & Associates', 'CA', 'CA Nitin Kapoor',
   '+919810000005', '+919810000005', 4.9, 58,
   'Connaught Place', 'CP Block A', 'New Delhi', 'Delhi', '110001',
   '["GST Filing", "Audit", "Company Registration", "ITR"]', 'low', 55, 'interested',
   'referral', '{ca,cp}')
on conflict (id) do nothing;

-- Coordinates for the map view (also fixes rows seeded before Phase 4).
update public.aiwebsite_leads set latitude = 28.6519, longitude = 77.1909
  where id = '22222222-2222-4222-8222-222222222201' and latitude is null;
update public.aiwebsite_leads set latitude = 28.5494, longitude = 77.2425
  where id = '22222222-2222-4222-8222-222222222202' and latitude is null;
update public.aiwebsite_leads set latitude = 28.4595, longitude = 77.0870
  where id = '22222222-2222-4222-8222-222222222203' and latitude is null;
update public.aiwebsite_leads set latitude = 28.5708, longitude = 77.3260
  where id = '22222222-2222-4222-8222-222222222204' and latitude is null;
update public.aiwebsite_leads set latitude = 28.6315, longitude = 77.2167
  where id = '22222222-2222-4222-8222-222222222205' and latitude is null;

-- ── A deployed demo site with a version + sections ───────────────────

insert into public.aiwebsite_sites
  (id, lead_id, template_id, slug, name, mode, status, language_mode, color_variant, layout_variant,
   branding, demo_expires_at, published_at)
values
  ('33333333-3333-4333-8333-333333333301',
   '22222222-2222-4222-8222-222222222201',
   '11111111-1111-4111-8111-111111111101',
   'smiledental', 'Smile Dental Care', 'demo', 'live', 'en', 'mint', 'classic',
   '{"primary":"#0ea5a3","secondary":"#134e4a","accent":"#f59e0b","font_heading":"Poppins","font_body":"Inter"}',
   now() + interval '14 days', now())
on conflict (slug) do nothing;

insert into public.aiwebsite_site_versions (id, site_id, version_no, site_content, change_summary)
values
  ('44444444-4444-4444-8444-444444444401',
   '33333333-3333-4333-8333-333333333301', 1,
   '{
      "meta": {"title": "Smile Dental Care — Dentist in Karol Bagh", "description": "Trusted dental clinic in Karol Bagh, New Delhi. Root canal, implants, braces. Book an appointment today."},
      "hero": {"title": "Healthy smiles for the whole family", "subtitle": "Advanced, painless dentistry in the heart of Karol Bagh — trusted by 300+ happy patients.", "cta_primary": "Book Appointment", "cta_secondary": "Call Now"},
      "about": {"heading": "About Smile Dental Care", "body": "Led by Dr. Anjali Mehra, our clinic combines modern equipment with gentle care."},
      "services": [
        {"name": "Root Canal Treatment", "description": "Single-sitting, painless RCT with digital X-ray guidance.", "icon": "tooth"},
        {"name": "Dental Implants", "description": "Permanent, natural-looking replacements for missing teeth.", "icon": "implant"},
        {"name": "Braces & Aligners", "description": "Metal, ceramic and invisible aligner options for all ages.", "icon": "braces"},
        {"name": "Teeth Whitening", "description": "In-clinic whitening for a visibly brighter smile in one visit.", "icon": "sparkle"}
      ],
      "faqs": [
        {"q": "Do you offer painless root canal?", "a": "Yes — we use rotary endodontics and local anaesthesia for a comfortable experience."},
        {"q": "Are EMI options available for implants?", "a": "Yes, flexible EMI plans are available for major treatments."}
      ],
      "testimonials": [
        {"name": "Sample Patient", "text": "Wonderful experience, completely painless treatment. (Sample testimonial)", "rating": 5}
      ]
    }'::jsonb,
   'Initial seed content')
on conflict (site_id, version_no) do nothing;

update public.aiwebsite_sites
  set current_version_id = '44444444-4444-4444-8444-444444444401'
  where id = '33333333-3333-4333-8333-333333333301' and current_version_id is null;

-- Canonical SiteContent (packages/templates schema). Overwrites the legacy
-- shape on re-runs so the renderer always gets valid content.
update public.aiwebsite_site_versions set site_content = '{
  "meta": {
    "title": "Smile Dental Care — Dentist in Karol Bagh, New Delhi",
    "description": "Trusted dental clinic in Karol Bagh: painless root canal, implants, braces and whitening. 4.7★ from 312 Google reviews. Book on WhatsApp.",
    "keywords": ["dentist karol bagh", "root canal delhi", "dental implants"]
  },
  "business": {
    "name": "Smile Dental Care",
    "category": "Dental Clinic",
    "phone": "+91 98100 00001",
    "whatsapp": "+91 98100 00001",
    "email": "care@smiledentalcare.in",
    "address": "12 Ajmal Khan Road, Karol Bagh",
    "area": "Karol Bagh",
    "city": "New Delhi",
    "mapUrl": "",
    "mapEmbedUrl": "",
    "rating": 4.7,
    "reviewCount": 312,
    "socials": { "instagram": "", "facebook": "", "linkedin": "" },
    "openingHours": [
      { "days": "Mon – Sat", "hours": "10:00 AM – 8:30 PM" },
      { "days": "Sunday", "hours": "Closed" }
    ]
  },
  "hero": {
    "badge": "Painless • Modern • Trusted",
    "title": "Healthy smiles for the whole family",
    "subtitle": "Advanced, painless dentistry in the heart of Karol Bagh — trusted by 300+ happy patients.",
    "ctaPrimary": "Book Appointment",
    "ctaSecondary": "Call Now",
    "image": null
  },
  "about": {
    "heading": "About Smile Dental Care",
    "body": "Led by Dr. Anjali Mehra, our clinic combines modern equipment with gentle, patient-first care. From routine check-ups to full smile makeovers, every treatment is planned around your comfort.",
    "highlights": ["Single-sitting RCT", "Digital X-ray", "EMI available", "Strict sterilization"],
    "image": null
  },
  "services": {
    "heading": "Our Services",
    "items": [
      { "name": "Root Canal Treatment", "description": "Single-sitting, painless RCT with digital X-ray guidance.", "icon": "tooth" },
      { "name": "Dental Implants", "description": "Permanent, natural-looking replacements for missing teeth.", "icon": "implant" },
      { "name": "Braces & Aligners", "description": "Metal, ceramic and invisible aligner options for all ages.", "icon": "braces" },
      { "name": "Teeth Whitening", "description": "In-clinic whitening for a visibly brighter smile in one visit.", "icon": "sparkles" }
    ]
  },
  "whyUs": {
    "heading": "Why Choose Us",
    "items": [
      { "title": "Painless Treatment", "description": "Modern anaesthesia and rotary endodontics." },
      { "title": "Transparent Pricing", "description": "Estimates before every procedure, EMI plans available." },
      { "title": "Experienced Team", "description": "10+ years and thousands of happy patients." },
      { "title": "Hygiene First", "description": "Hospital-grade sterilization for every instrument." }
    ]
  },
  "gallery": { "heading": "Gallery", "images": [] },
  "testimonials": {
    "heading": "What Patients Say",
    "items": [
      { "name": "Sample Patient", "text": "Wonderful experience, completely painless treatment.", "rating": 5 },
      { "name": "Local Resident", "text": "Very hygienic clinic and courteous staff.", "rating": 5 }
    ]
  },
  "faqs": {
    "heading": "Frequently Asked Questions",
    "items": [
      { "q": "Do you offer painless root canal?", "a": "Yes — we use rotary endodontics and local anaesthesia for a comfortable, single-sitting experience." },
      { "q": "Are EMI options available for implants?", "a": "Yes, flexible EMI plans are available for implants and major treatments." }
    ]
  },
  "reviews": {
    "heading": "Loved on Google",
    "snippets": [
      "Completely painless root canal, doctor explained everything clearly.",
      "Very hygienic clinic and courteous staff. Worth every rupee.",
      "My kids actually enjoy dental visits now!"
    ]
  },
  "cta": {
    "heading": "Ready for a healthier smile?",
    "subheading": "Message us on WhatsApp — we reply within minutes.",
    "buttonText": "Book Appointment"
  },
  "contact": { "heading": "Contact Us", "note": "Walk-ins welcome; appointments get priority." },
  "footer": { "tagline": "Gentle dentistry, brilliant smiles." }
}'::jsonb
where id = '44444444-4444-4444-8444-444444444401';

insert into public.aiwebsite_site_sections (site_id, section_key, content, ai_generated)
values
  ('33333333-3333-4333-8333-333333333301', 'hero',
   '{"title": "Healthy smiles for the whole family", "subtitle": "Advanced, painless dentistry in the heart of Karol Bagh — trusted by 300+ happy patients."}', true),
  ('33333333-3333-4333-8333-333333333301', 'about',
   '{"heading": "About Smile Dental Care", "body": "Led by Dr. Anjali Mehra, our clinic combines modern equipment with gentle care."}', true)
on conflict (site_id, section_key) do nothing;

insert into public.aiwebsite_deployments (site_id, action, status, message, completed_at)
values
  ('33333333-3333-4333-8333-333333333301', 'publish', 'success', 'Seed publish of smiledental demo', now());

-- ── Sample engagement data (hot-lead signal) ─────────────────────────

insert into public.aiwebsite_site_visits (id, site_id, visitor_key, device_type, path, duration_sec)
values
  ('55555555-5555-4555-8555-555555555501', '33333333-3333-4333-8333-333333333301', 'seed-visitor-1', 'mobile', '/', 95),
  ('55555555-5555-4555-8555-555555555502', '33333333-3333-4333-8333-333333333301', 'seed-visitor-1', 'mobile', '/', 40)
on conflict (id) do nothing;

insert into public.aiwebsite_site_events (visit_id, site_id, event_type, section)
values
  ('55555555-5555-4555-8555-555555555501', '33333333-3333-4333-8333-333333333301', 'page_view', null),
  ('55555555-5555-4555-8555-555555555501', '33333333-3333-4333-8333-333333333301', 'cta_whatsapp', 'hero');

-- ── Message templates (WhatsApp pitch + follow-up sequence + email) ──

insert into public.aiwebsite_message_templates (key, channel, name, subject, body, language)
values
  ('whatsapp_pitch_v1', 'whatsapp', 'Initial demo pitch (Hinglish)', null,
   'Namaste {owner} ji! 🙏 Maine dekha ki {business} ki Google rating {rating}⭐ hai ({reviews} reviews) — kaafi impressive! Humne aapke business ke liye ek premium website demo ready ki hai, ek baar zaroor dekhiye: {demo_url} — Agar pasand aaye toh reply kijiye, 2 minute mein call par baat kar sakte hain. — Team AIVEXA', 'bilingual'),
  ('whatsapp_followup_day2', 'whatsapp', 'Follow-up day 2', null,
   '{owner} ji, kal wali website demo dekhi aapne? {demo_url} — koi bhi change chahiye toh bata dijiye, hum turant update kar denge. 😊', 'bilingual'),
  ('whatsapp_followup_day5', 'whatsapp', 'Follow-up day 5', null,
   '{owner} ji, {area} ke kai businesses ab online aa rahe hain. Aapki demo website sirf kuch din aur live rahegi: {demo_url} — chaliye isse aapki apni website bana dete hain?', 'bilingual'),
  ('whatsapp_followup_day10', 'whatsapp', 'Follow-up day 10 (last)', null,
   '{owner} ji, aapki demo website is hafte expire ho rahi hai. Agar interested hain toh aaj hi bataiye — special launch price ke saath domain + website ready kar denge. {demo_url}', 'bilingual'),
  ('email_pitch_v1', 'email', 'Initial demo pitch (email)', 'A ready website for {business} — take a look',
   'Hello {owner},\n\nWe noticed {business} has an excellent {rating}-star rating with {reviews} reviews on Google — but no website that does it justice.\n\nSo we built one. Your demo is live here: {demo_url}\n\nIf you like it, reply to this email or WhatsApp us and we will make it yours with your own domain.\n\nBest regards,\nTeam AIVEXA', 'en')
on conflict (key, version) do nothing;

-- ── Prompt templates (Phase 6 refines; strong defaults now) ──────────

insert into public.aiwebsite_prompt_templates (key, category, name, system_prompt, tone)
values
  ('site_content_default', null, 'Default website content generator',
   'You are an expert website copywriter for Indian local businesses. Generate complete, conversion-focused website content as strict JSON matching the provided SiteContent schema. Rules: never invent facts not present in the lead data; testimonials must be clearly generic samples, never real named people; keep language simple and trustworthy; include locality references (area, city) naturally for local SEO.', 'premium'),
  ('site_content_dental', 'Dental Clinic', 'Dental clinic content generator',
   'You are an expert medical website copywriter. Generate complete website content as strict JSON matching the provided SiteContent schema for a dental clinic. Rules: professional, reassuring, medically accurate tone; emphasize painless treatment, hygiene and modern equipment; never invent doctor credentials or clinical claims not present in lead data; testimonials must be clearly generic samples.', 'medical-professional'),
  ('whatsapp_pitch', null, 'WhatsApp pitch personalizer',
   'You write short, warm Hinglish WhatsApp messages for Indian business owners. Personalize using the owner name, business name, real Google rating/review count, and 1-2 specific compliments derived from the actual review data provided. Include the demo URL. Max 3 short paragraphs, one emoji per paragraph maximum, no fake claims.', 'friendly')
on conflict (key, version) do nothing;

-- ── Follow-ups & timeline entries ────────────────────────────────────

insert into public.aiwebsite_follow_ups (lead_id, due_at, note, status)
values
  ('22222222-2222-4222-8222-222222222201', now() + interval '1 day', 'Call Dr. Mehra — demo was viewed twice from mobile', 'pending'),
  ('22222222-2222-4222-8222-222222222203', now() + interval '2 days', 'Send day-2 WhatsApp follow-up', 'pending'),
  ('22222222-2222-4222-8222-222222222205', now() - interval '1 day', 'Share quotation draft', 'pending');

insert into public.aiwebsite_lead_activities (lead_id, type, title, detail)
values
  ('22222222-2222-4222-8222-222222222201', 'demo_view', 'Demo viewed (mobile, 95s)', '{"source": "seed", "device": "mobile"}'),
  ('22222222-2222-4222-8222-222222222201', 'demo_view', 'Demo viewed again + WhatsApp button clicked', '{"source": "seed", "cta": "whatsapp"}'),
  ('22222222-2222-4222-8222-222222222203', 'message_sent', 'WhatsApp pitch sent', '{"template": "whatsapp_pitch_v1"}'),
  ('22222222-2222-4222-8222-222222222205', 'note', 'Owner asked for pricing on call', '{}');
