-- ═══════════════════════════════════════════════════════════════════
-- 0013_phone_identity.sql — Instant Business Website AI (Phase 3)
-- Canonical E.164 phone columns on leads (trigger-maintained, not a
-- generated column, so the normalization rule can evolve without a
-- column rewrite) + inbound/outbound direction on messages.
-- Depends on: 0002_core_schema.sql.
-- ═══════════════════════════════════════════════════════════════════

-- ── Normalization ────────────────────────────────────────────────────
-- Assumes Indian numbers (10-digit local, +91 country code) — the only
-- market this pipeline serves today. Returns null for anything that
-- doesn't resolve to a plausible number rather than guessing.

create or replace function public.aiwebsite_normalize_phone_e164(p_raw text)
returns text
language plpgsql
immutable
as $$
declare
  v_digits text;
begin
  if p_raw is null or btrim(p_raw) = '' then
    return null;
  end if;

  -- Keep a leading + (if present) out of the digit-only pass.
  v_digits := regexp_replace(p_raw, '[^0-9]', '', 'g');

  if v_digits = '' then
    return null;
  end if;

  -- Strip a leading trunk '0' before a 10-digit local number (e.g. 0XXXXXXXXXX).
  if length(v_digits) = 11 and left(v_digits, 1) = '0' then
    v_digits := substring(v_digits from 2);
  end if;

  -- Bare 10-digit local number.
  if length(v_digits) = 10 then
    return '+91' || v_digits;
  end if;

  -- Already has the 91 country code (91 + 10 digits = 12).
  if length(v_digits) = 12 and left(v_digits, 2) = '91' then
    return '+' || v_digits;
  end if;

  -- Anything else that's a plausible full international number
  -- (11–15 digits, already includes a country code) — pass through
  -- with a + prefix rather than guess further.
  if length(v_digits) between 11 and 15 then
    return '+' || v_digits;
  end if;

  return null;
end;
$$;

-- ── Leads: canonical phone/whatsapp + reply tracking ────────────────

alter table public.aiwebsite_leads
  add column phone_e164 text,
  add column whatsapp_e164 text,
  add column replied_at timestamptz;

create or replace function public.aiwebsite_leads_sync_phone_e164()
returns trigger
language plpgsql
as $$
begin
  new.phone_e164 := public.aiwebsite_normalize_phone_e164(new.phone);
  new.whatsapp_e164 := public.aiwebsite_normalize_phone_e164(new.whatsapp);
  return new;
end;
$$;

create trigger aiwebsite_leads_sync_phone_e164
  before insert or update of phone, whatsapp on public.aiwebsite_leads
  for each row execute function public.aiwebsite_leads_sync_phone_e164();

-- Backfill existing rows (trigger only fires on future writes).
update public.aiwebsite_leads
set phone_e164 = public.aiwebsite_normalize_phone_e164(phone),
    whatsapp_e164 = public.aiwebsite_normalize_phone_e164(whatsapp);

-- Not unique: two leads can legitimately share a number (shared business
-- line, reused mobile). Reply attribution resolves ambiguity in app code
-- (see findLeadByPhone) instead of relying on a DB constraint.
create index aiwebsite_leads_phone_e164_idx
  on public.aiwebsite_leads (phone_e164) where phone_e164 is not null and deleted_at is null;
create index aiwebsite_leads_whatsapp_e164_idx
  on public.aiwebsite_leads (whatsapp_e164) where whatsapp_e164 is not null and deleted_at is null;

-- ── Messages: inbound/outbound direction ─────────────────────────────

create type public.aiwebsite_message_direction as enum ('outbound', 'inbound');

alter table public.aiwebsite_messages
  add column direction public.aiwebsite_message_direction not null default 'outbound';

create index aiwebsite_messages_lead_direction_idx
  on public.aiwebsite_messages (lead_id, direction, created_at desc);
