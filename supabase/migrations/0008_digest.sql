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
