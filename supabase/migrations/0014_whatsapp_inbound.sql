-- ═══════════════════════════════════════════════════════════════════
-- 0014_whatsapp_inbound.sql — Instant Business Website AI (Phase 4)
-- New enum values for the inbound WhatsApp webhook: a lead-timeline
-- activity type for received replies, and two notification types (a
-- clean match vs. an ambiguous one that needs manual review).
-- Depends on: 0002_core_schema.sql, 0006_notifications.sql.
-- ═══════════════════════════════════════════════════════════════════

alter type public.aiwebsite_activity_type add value if not exists 'message_received';

alter type public.aiwebsite_notification_type add value if not exists 'inbound_reply';
alter type public.aiwebsite_notification_type add value if not exists 'inbound_reply_ambiguous';
