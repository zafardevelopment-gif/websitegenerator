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
