-- ═══════════════════════════════════════════════════════════════════
-- 0004_audit.sql — Instant Business Website AI (Phase 2)
-- Generic audit logging: before/after JSON of every mutation on
-- business-critical tables, with the acting user.
-- ═══════════════════════════════════════════════════════════════════

create table public.aiwebsite_audit_logs (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id text,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb,
  changed_by uuid,
  created_at timestamptz not null default now()
);

create index aiwebsite_audit_logs_table_idx
  on public.aiwebsite_audit_logs (table_name, created_at desc);
create index aiwebsite_audit_logs_record_idx
  on public.aiwebsite_audit_logs (record_id);

-- Read: owner/admin only. No write policies — rows are created solely by
-- the SECURITY DEFINER trigger below.
alter table public.aiwebsite_audit_logs enable row level security;
create policy "editors read audit log" on public.aiwebsite_audit_logs
  for select to authenticated using (public.aiwebsite_is_editor());

create or replace function public.aiwebsite_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record_id text;
begin
  if tg_op = 'INSERT' then
    v_record_id := to_jsonb(new) ->> 'id';
    if v_record_id is null then v_record_id := to_jsonb(new) ->> 'key'; end if;
    insert into public.aiwebsite_audit_logs (table_name, record_id, action, new_data, changed_by)
    values (tg_table_name, v_record_id, 'INSERT', to_jsonb(new), auth.uid());
    return new;
  elsif tg_op = 'UPDATE' then
    v_record_id := to_jsonb(new) ->> 'id';
    if v_record_id is null then v_record_id := to_jsonb(new) ->> 'key'; end if;
    insert into public.aiwebsite_audit_logs (table_name, record_id, action, old_data, new_data, changed_by)
    values (tg_table_name, v_record_id, 'UPDATE', to_jsonb(old), to_jsonb(new), auth.uid());
    return new;
  else
    v_record_id := to_jsonb(old) ->> 'id';
    if v_record_id is null then v_record_id := to_jsonb(old) ->> 'key'; end if;
    insert into public.aiwebsite_audit_logs (table_name, record_id, action, old_data, changed_by)
    values (tg_table_name, v_record_id, 'DELETE', to_jsonb(old), auth.uid());
    return old;
  end if;
end;
$$;

-- Attach to business-critical tables.
create trigger aiwebsite_audit_leads
  after insert or update or delete on public.aiwebsite_leads
  for each row execute function public.aiwebsite_audit();

create trigger aiwebsite_audit_sites
  after insert or update or delete on public.aiwebsite_sites
  for each row execute function public.aiwebsite_audit();

create trigger aiwebsite_audit_settings
  after insert or update or delete on public.aiwebsite_settings
  for each row execute function public.aiwebsite_audit();

create trigger aiwebsite_audit_quotations
  after insert or update or delete on public.aiwebsite_quotations
  for each row execute function public.aiwebsite_audit();

create trigger aiwebsite_audit_payments
  after insert or update or delete on public.aiwebsite_payments
  for each row execute function public.aiwebsite_audit();

create trigger aiwebsite_audit_clients
  after insert or update or delete on public.aiwebsite_clients
  for each row execute function public.aiwebsite_audit();

create trigger aiwebsite_audit_domains
  after insert or update or delete on public.aiwebsite_domains
  for each row execute function public.aiwebsite_audit();
