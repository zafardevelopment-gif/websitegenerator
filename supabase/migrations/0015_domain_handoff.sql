-- ═══════════════════════════════════════════════════════════════════
-- 0015_domain_handoff.sql — Instant Business Website AI (Phase 7)
-- Won-deal migration: once a client's custom domain verifies, the old
-- demo slot 301s to it for a grace window instead of going dead
-- overnight, then the slot is released back to the pool automatically.
-- Depends on: 0002_core_schema.sql, 0011_demo_slots.sql.
-- ═══════════════════════════════════════════════════════════════════

alter table public.aiwebsite_sites
  add column redirect_to_domain text,
  add column redirect_grace_ends_at timestamptz;

create index aiwebsite_sites_redirect_grace_idx
  on public.aiwebsite_sites (redirect_grace_ends_at)
  where redirect_to_domain is not null and deleted_at is null;
