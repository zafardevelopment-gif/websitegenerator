-- ═══════════════════════════════════════════════════════════════════
-- 0005_media_category.sql — Instant Business Website AI (Phase 8)
-- Stock image pools are organized by business category.
-- ═══════════════════════════════════════════════════════════════════

alter table public.aiwebsite_media_assets
  add column if not exists category text;

create index if not exists aiwebsite_media_assets_stock_idx
  on public.aiwebsite_media_assets (is_stock, category)
  where deleted_at is null;
