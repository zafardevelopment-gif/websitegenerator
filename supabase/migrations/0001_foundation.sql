-- ═══════════════════════════════════════════════════════════════════
-- 0001_foundation.sql — Instant Business Website AI (Phase 1)
-- Tables: aiwebsite_users, aiwebsite_settings
-- Conventions: every table/enum is prefixed aiwebsite_; RLS on everything;
-- updated_at maintained by trigger; soft delete via deleted_at.
-- ═══════════════════════════════════════════════════════════════════

-- ── Enums ────────────────────────────────────────────────────────────

create type public.aiwebsite_user_role as enum ('owner', 'admin', 'viewer');

-- ── Shared trigger: updated_at ───────────────────────────────────────

create or replace function public.aiwebsite_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── aiwebsite_users ──────────────────────────────────────────────────
-- Mirrors auth.users for internal team members. Row is created
-- automatically by trigger when an auth user signs up / is invited.

create table public.aiwebsite_users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role public.aiwebsite_user_role not null default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger aiwebsite_users_set_updated_at
  before update on public.aiwebsite_users
  for each row execute function public.aiwebsite_set_updated_at();

-- Current user's role — SECURITY DEFINER so RLS policies can call it
-- without recursing into aiwebsite_users' own policies.
create or replace function public.aiwebsite_current_role()
returns public.aiwebsite_user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.aiwebsite_users
  where id = auth.uid() and deleted_at is null;
$$;

-- First auth user becomes owner; everyone after that defaults to admin.
create or replace function public.aiwebsite_handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing int;
begin
  select count(*) into v_existing from public.aiwebsite_users;
  insert into public.aiwebsite_users (id, email, role)
  values (
    new.id,
    coalesce(new.email, ''),
    case when v_existing = 0 then 'owner'::public.aiwebsite_user_role
         else 'admin'::public.aiwebsite_user_role end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger aiwebsite_on_auth_user_created
  after insert on auth.users
  for each row execute function public.aiwebsite_handle_new_auth_user();

-- Only owners may change roles (blocks self-escalation through the
-- own-row update policy).
create or replace function public.aiwebsite_guard_role_change()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role
     and public.aiwebsite_current_role() is distinct from 'owner' then
    raise exception 'Only the owner can change user roles';
  end if;
  return new;
end;
$$;

create trigger aiwebsite_users_guard_role_change
  before update on public.aiwebsite_users
  for each row execute function public.aiwebsite_guard_role_change();

alter table public.aiwebsite_users enable row level security;

create policy "team members can view team"
  on public.aiwebsite_users for select
  to authenticated
  using (true);

create policy "users update own profile, owner updates anyone"
  on public.aiwebsite_users for update
  to authenticated
  using (id = auth.uid() or public.aiwebsite_current_role() = 'owner')
  with check (id = auth.uid() or public.aiwebsite_current_role() = 'owner');

create policy "owner can delete users"
  on public.aiwebsite_users for delete
  to authenticated
  using (public.aiwebsite_current_role() = 'owner');

-- No INSERT policy: rows are created only by the auth trigger
-- (SECURITY DEFINER) — clients cannot insert directly.

-- ── aiwebsite_settings ───────────────────────────────────────────────
-- Key-value application settings. Secret values (API keys) are stored
-- AES-256-GCM encrypted by the server before insert; the ciphertext is
-- useless without SETTINGS_ENCRYPTION_KEY, which never touches the DB.

create table public.aiwebsite_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  is_secret boolean not null default false,
  updated_by uuid references public.aiwebsite_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger aiwebsite_settings_set_updated_at
  before update on public.aiwebsite_settings
  for each row execute function public.aiwebsite_set_updated_at();

alter table public.aiwebsite_settings enable row level security;

create policy "team members can read settings"
  on public.aiwebsite_settings for select
  to authenticated
  using (public.aiwebsite_current_role() is not null);

create policy "owner can insert settings"
  on public.aiwebsite_settings for insert
  to authenticated
  with check (public.aiwebsite_current_role() = 'owner');

create policy "owner can update settings"
  on public.aiwebsite_settings for update
  to authenticated
  using (public.aiwebsite_current_role() = 'owner')
  with check (public.aiwebsite_current_role() = 'owner');

create policy "owner can delete settings"
  on public.aiwebsite_settings for delete
  to authenticated
  using (public.aiwebsite_current_role() = 'owner');
