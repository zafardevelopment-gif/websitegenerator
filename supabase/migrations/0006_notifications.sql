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
