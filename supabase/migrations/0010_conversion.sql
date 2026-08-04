-- ═══════════════════════════════════════════════════════════════════
-- 0010_conversion.sql — Instant Business Website AI (Phase 14)
-- New notification type for client renewal reminders (domain/hosting
-- expiry). Quotations/payments/clients/domains tables already exist
-- from 0002_core_schema.sql — this migration only adds the enum value
-- the renewal-reminder cron needs.
-- ═══════════════════════════════════════════════════════════════════

alter type public.aiwebsite_notification_type add value if not exists 'renewal_reminder';
