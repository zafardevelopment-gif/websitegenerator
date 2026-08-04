-- ═══════════════════════════════════════════════════════════════════
-- 0012_slot_expiry_notifications.sql — Instant Business Website AI (Phase 2)
-- New notification type for the T-3-day demo-expiry warning fired by the
-- expire-demos cron. Depends on: 0006_notifications.sql.
-- ═══════════════════════════════════════════════════════════════════

alter type public.aiwebsite_notification_type add value if not exists 'demo_expiring_soon';
