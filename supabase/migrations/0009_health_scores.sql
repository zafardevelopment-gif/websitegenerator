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
