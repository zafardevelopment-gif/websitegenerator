-- ═══════════════════════════════════════════════════════════════════
-- 0007_outreach.sql — Instant Business Website AI (Phase 11)
-- Email open-tracking token + PDF proposal storage on messages.
-- ═══════════════════════════════════════════════════════════════════

alter table public.aiwebsite_messages
  add column if not exists open_token uuid not null default gen_random_uuid(),
  add column if not exists pdf_url text;

create unique index if not exists aiwebsite_messages_open_token_idx
  on public.aiwebsite_messages (open_token);
