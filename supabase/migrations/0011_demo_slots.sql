-- ═══════════════════════════════════════════════════════════════════
-- 0011_demo_slots.sql — Instant Business Website AI (Roadmap Phase 1)
--
-- Demo subdomain slot pool.
--
-- Before this migration every published demo minted its own permanent
-- slug (`smile-dental.aivexallp.com`) which was never released — hosting
-- grew without bound and a won deal left a dead subdomain behind.
--
-- Instead we lease from a fixed pool (`demo1 … demo10`). A slot is held
-- for the length of one pitch and returned when the deal closes, is lost,
-- or the demo expires. A released slot passes through `cooldown` first so
-- a stale URL still in circulation can't surface a different business.
--
-- Lifecycle:
--   free ──claim──> occupied ──release──> cooldown ──sweep──> free
--                       │
--                       └──disable──> disabled (taken out of rotation)
--
-- Depends on: 0002_core_schema.sql (aiwebsite_sites, aiwebsite_leads,
--             aiwebsite_users, aiwebsite_set_updated_at, aiwebsite_is_*).
-- ═══════════════════════════════════════════════════════════════════

-- ── Enum ─────────────────────────────────────────────────────────────

do $$
begin
  if not exists (select 1 from pg_type where typname = 'aiwebsite_slot_status') then
    create type public.aiwebsite_slot_status as enum (
      'free', 'reserved', 'occupied', 'cooldown', 'disabled'
    );
  end if;
end
$$;

-- ── Table ────────────────────────────────────────────────────────────

create table if not exists public.aiwebsite_demo_slots (
  slug text primary key
    check (slug ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$' and char_length(slug) between 3 and 63),
  position integer not null,
  status public.aiwebsite_slot_status not null default 'free',

  -- Current holder. Both cleared when the slot returns to the pool.
  site_id uuid references public.aiwebsite_sites (id) on delete set null,
  lead_id uuid references public.aiwebsite_leads (id) on delete set null,

  assigned_at timestamptz,
  -- Mirror of the site's demo_expires_at; lets the sweep query slots alone.
  expires_at timestamptz,
  -- When cooldown ends and the slot may be re-leased.
  cooldown_until timestamptz,
  released_at timestamptz,

  -- Total leases ever served; useful for spotting a slug that has been
  -- shared too widely and should be retired.
  lease_count integer not null default 0,

  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.aiwebsite_demo_slots is
  'Reusable demo subdomain pool. One row per subdomain; leased to a site for the length of a pitch.';

create unique index if not exists aiwebsite_demo_slots_position_idx
  on public.aiwebsite_demo_slots (position);

-- A site may hold at most one slot at a time.
create unique index if not exists aiwebsite_demo_slots_site_idx
  on public.aiwebsite_demo_slots (site_id)
  where site_id is not null;

create index if not exists aiwebsite_demo_slots_status_idx
  on public.aiwebsite_demo_slots (status, position);

create index if not exists aiwebsite_demo_slots_expiry_idx
  on public.aiwebsite_demo_slots (expires_at)
  where status = 'occupied';

create index if not exists aiwebsite_demo_slots_cooldown_idx
  on public.aiwebsite_demo_slots (cooldown_until)
  where status = 'cooldown';

-- Holder columns must be consistent with status.
alter table public.aiwebsite_demo_slots
  drop constraint if exists aiwebsite_demo_slots_holder_ck;
alter table public.aiwebsite_demo_slots
  add constraint aiwebsite_demo_slots_holder_ck check (
    (status in ('occupied', 'reserved') and site_id is not null)
    or (status in ('free', 'disabled') and site_id is null)
    or status = 'cooldown'
  );

drop trigger if exists aiwebsite_demo_slots_updated_at on public.aiwebsite_demo_slots;
create trigger aiwebsite_demo_slots_updated_at
  before update on public.aiwebsite_demo_slots
  for each row execute function public.aiwebsite_set_updated_at();

-- ── Seed the default pool (demo1 … demo10) ───────────────────────────

insert into public.aiwebsite_demo_slots (slug, position)
select 'demo' || n, n from generate_series(1, 10) as n
on conflict (slug) do nothing;

-- ── claim: lease the lowest-numbered available slot ──────────────────
--
-- Concurrency-safe: `for update skip locked` means two simultaneous
-- publishes take two different slots instead of blocking or colliding.
-- Re-claiming for a site that already holds a slot is a no-op refresh,
-- so retrying a failed publish never consumes a second slot.

create or replace function public.aiwebsite_claim_demo_slot(
  p_site_id uuid,
  p_lead_id uuid,
  p_expires_at timestamptz default null,
  p_preferred_slug text default null
)
returns public.aiwebsite_demo_slots
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot public.aiwebsite_demo_slots;
begin
  -- Idempotent: this site already holds a slot → refresh its expiry.
  select * into v_slot
    from public.aiwebsite_demo_slots
   where site_id = p_site_id
   for update;

  if found then
    update public.aiwebsite_demo_slots
       set status      = 'occupied',
           lead_id     = coalesce(p_lead_id, lead_id),
           expires_at  = coalesce(p_expires_at, expires_at),
           assigned_at = coalesce(assigned_at, now()),
           released_at = null,
           cooldown_until = null
     where slug = v_slot.slug
     returning * into v_slot;
    return v_slot;
  end if;

  -- A specific slug was asked for (manual assignment from the pool view).
  if p_preferred_slug is not null then
    select * into v_slot
      from public.aiwebsite_demo_slots
     where slug = p_preferred_slug
       and status = 'free'
     for update skip locked;
  end if;

  -- Otherwise take the lowest-numbered free slot.
  if v_slot.slug is null then
    select * into v_slot
      from public.aiwebsite_demo_slots
     where status = 'free'
     order by position
     limit 1
     for update skip locked;
  end if;

  if v_slot.slug is null then
    raise exception 'No free demo slot available'
      using errcode = 'P0002',
            hint = 'Release a slot or grow the pool in Settings → Demo slots.';
  end if;

  update public.aiwebsite_demo_slots
     set status         = 'occupied',
         site_id        = p_site_id,
         lead_id        = p_lead_id,
         assigned_at    = now(),
         expires_at     = p_expires_at,
         released_at    = null,
         cooldown_until = null,
         lease_count    = lease_count + 1
   where slug = v_slot.slug
   returning * into v_slot;

  return v_slot;
end;
$$;

-- ── release: return a slot to the pool via cooldown ───────────────────

create or replace function public.aiwebsite_release_demo_slot(
  p_slug text,
  p_cooldown_days integer default 3,
  p_note text default null
)
returns public.aiwebsite_demo_slots
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot public.aiwebsite_demo_slots;
begin
  update public.aiwebsite_demo_slots
     set status         = case when p_cooldown_days > 0 then 'cooldown'::public.aiwebsite_slot_status
                               else 'free'::public.aiwebsite_slot_status end,
         site_id        = null,
         lead_id        = null,
         assigned_at    = null,
         expires_at     = null,
         cooldown_until = case when p_cooldown_days > 0
                               then now() + make_interval(days => p_cooldown_days)
                               else null end,
         released_at    = now(),
         note           = coalesce(p_note, note)
   where slug = p_slug
     and status <> 'disabled'
   returning * into v_slot;

  if not found then
    raise exception 'Demo slot % not found or disabled', p_slug using errcode = 'P0002';
  end if;

  return v_slot;
end;
$$;

/** Release whichever slot a site holds (no-op if it holds none). */
create or replace function public.aiwebsite_release_demo_slot_for_site(
  p_site_id uuid,
  p_cooldown_days integer default 3,
  p_note text default null
)
returns public.aiwebsite_demo_slots
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug text;
begin
  select slug into v_slug from public.aiwebsite_demo_slots where site_id = p_site_id;
  if v_slug is null then
    return null;
  end if;
  return public.aiwebsite_release_demo_slot(v_slug, p_cooldown_days, p_note);
end;
$$;

-- ── sweep: cooldown → free (called by the nightly cron) ──────────────

create or replace function public.aiwebsite_sweep_demo_slots()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.aiwebsite_demo_slots
     set status = 'free', cooldown_until = null
   where status = 'cooldown'
     and (cooldown_until is null or cooldown_until <= now());
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ── RLS ──────────────────────────────────────────────────────────────

alter table public.aiwebsite_demo_slots enable row level security;

drop policy if exists aiwebsite_demo_slots_select on public.aiwebsite_demo_slots;
create policy aiwebsite_demo_slots_select on public.aiwebsite_demo_slots
  for select using (public.aiwebsite_is_team());

drop policy if exists aiwebsite_demo_slots_write on public.aiwebsite_demo_slots;
create policy aiwebsite_demo_slots_write on public.aiwebsite_demo_slots
  for all using (public.aiwebsite_is_editor()) with check (public.aiwebsite_is_editor());

revoke all on function public.aiwebsite_claim_demo_slot(uuid, uuid, timestamptz, text) from public;
revoke all on function public.aiwebsite_release_demo_slot(text, integer, text) from public;
revoke all on function public.aiwebsite_release_demo_slot_for_site(uuid, integer, text) from public;
revoke all on function public.aiwebsite_sweep_demo_slots() from public;

grant execute on function public.aiwebsite_claim_demo_slot(uuid, uuid, timestamptz, text) to authenticated, service_role;
grant execute on function public.aiwebsite_release_demo_slot(text, integer, text) to authenticated, service_role;
grant execute on function public.aiwebsite_release_demo_slot_for_site(uuid, integer, text) to authenticated, service_role;
grant execute on function public.aiwebsite_sweep_demo_slots() to service_role;
