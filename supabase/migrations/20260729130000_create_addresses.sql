-- Schema for the new "Адреса" section: one card per staffing object
-- (darkstore/shop/warehouse/PVZ/restaurant/…), unlike "Потребность" which
-- tracks project+city+position+date. Raw counters only — deficit, fill
-- rate and "unclosed demand" are computed in the client from
-- required_count/staffed_count, never stored (see addressMetrics.ts).
--
-- Text+CHECK is used instead of enum for object_type/status/schedule_type/
-- shift_type/payment_type — same reasoning as
-- staffing_demand_rows.status (see 20260724120000_create_staffing_demand_rows.sql):
-- the business is expected to extend these lists, and a CHECK can be
-- redefined in a single migration, unlike `ALTER TYPE ... ADD VALUE`, which
-- cannot be used in the same transaction that consumes the new value.
--
-- Row Level Security is enabled with NO policies here — policies are added
-- in 20260729130100_addresses_rls_policies.sql, following the same
-- two-step pattern as public.candidates / public.candidate_list_options.

create table public.addresses (
  id uuid primary key default gen_random_uuid(),

  -- Same enum as candidates/staffing_demand — no new project vocabulary.
  project public.candidate_project not null,

  -- Free text, hints from candidate_list_options (list_type = 'city') —
  -- same reference list as "Потребность"/"Кандидаты", no FK (consistent
  -- with staffing_demand.city).
  city text not null,

  -- Free text, hints from candidate_list_options (list_type = 'position') —
  -- deliberately named `position`, not `specialization`: this is the exact
  -- same shared dictionary used by "Потребность" and "Кандиданты"
  -- (candidates.position / staffing_demand.position), and a different
  -- column name here would read as a separate concept when it is not.
  position text,

  full_address text not null,
  metro text,
  district text,

  -- Kept as separate numeric columns (not a single free-text string) so a
  -- future map/routing/"nearest address" feature needs no migration.
  latitude numeric,
  longitude numeric,

  object_type text not null default 'other'
    check (object_type in ('darkstore', 'shop', 'warehouse', 'pvz', 'restaurant', 'production', 'office', 'other')),

  -- Raw staffing counters. Deficit / fill rate / "unclosed demand" are
  -- deliberately NOT columns here — always computed in TS from these, so
  -- there is nothing to keep in sync (see addressMetrics.ts).
  required_count integer not null default 0 check (required_count >= 0),
  staffed_count integer not null default 0 check (staffed_count >= 0),
  planned_start_count integer not null default 0 check (planned_start_count >= 0),
  in_progress_count integer not null default 0 check (in_progress_count >= 0),

  status text not null default 'unrestricted'
    check (status in ('stop', 'reserve', 'hiring_standby', 'any_candidate', 'unrestricted')),

  -- 5 = критический … 1 = минимальный.
  priority smallint not null default 3 check (priority between 1 and 5),

  schedule_type text
    check (schedule_type is null or schedule_type in ('2/2', '3/3', '5/2', '6/1', '7/0', 'flexible', 'parttime')),
  shift_type text
    check (shift_type is null or shift_type in ('day', 'night', 'mixed')),
  -- Multiple start times per day, e.g. {'08:00','14:00','20:00'}.
  shift_times text[] not null default '{}',

  payment_type text
    check (payment_type is null or payment_type in ('hourly', 'per_shift', 'per_order')),
  payment_amount numeric check (payment_amount is null or payment_amount >= 0),

  -- Hints from candidate_list_options (list_type = 'coordinator') — same
  -- dictionary as candidates.coordinator.
  coordinator_name text,
  coordinator_phone text,
  coordinator_telegram text,

  -- Free text on purpose: the person running the physical site is a
  -- different role than candidates.manager (a recruiting manager), so it
  -- does not reuse that dictionary.
  site_manager_name text,
  site_manager_phone text,

  coordinator_comment text check (coordinator_comment is null or char_length(coordinator_comment) <= 4000),

  -- Checkbox slugs, e.g. {'free_meals','uniform','parking'}. Labels live in
  -- addressOptions.ts, not here — new checkboxes need no migration.
  features text[] not null default '{}',

  -- Link-only "documents" (no Supabase Storage in this project yet — see
  -- ADR/requirements): [{"id": uuid, "title": text, "url": text, "type": text}, …].
  -- Kept as jsonb so sorting/filtering/removing one document never needs a
  -- schema change.
  document_links jsonb not null default '[]',

  -- Soft-delete, same convention as public.candidates. The UI presents this
  -- as an "Активные/Архив" segmented toggle, not a separate route.
  archived_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Light "who/when" snapshot in the row itself — not a substitute for full
  -- field-level history (a separate follow-up task), but enough to show
  -- "created by / last updated by" in the card header today. `*_login` is a
  -- text snapshot (same trick as portal_audit_log.actor_login) because
  -- portal_users is fully RLS-closed for `authenticated` — a plain join from
  -- the client could never resolve the name.
  created_by uuid references public.portal_users (id) on delete set null,
  created_by_login text,
  updated_by uuid references public.portal_users (id) on delete set null,
  updated_by_login text
);

comment on table public.addresses is
  'Объекты подбора («Адреса»): один объект = одна карточка, потребность и статус набора хранятся на объекте, не по датам. Soft-delete через archived_at.';
comment on column public.addresses.position is
  'Специализация/должность объекта. Тот же справочник, что candidates.position и staffing_demand.position (candidate_list_options, list_type = position) — намеренно назван position, а не specialization, чтобы не плодить второе имя для одного и того же понятия.';
comment on column public.addresses.document_links is
  'Только внешние ссылки на файлы — в проекте нет Supabase Storage. Формат: [{"id","title","url","type"}, …].';
comment on column public.addresses.created_by_login is
  'Текстовый снимок логина на момент вставки — portal_users закрыта RLS, join из клиента не сработает.';
comment on column public.addresses.updated_by_login is
  'Текстовый снимок логина на момент последнего изменения — см. created_by_login.';

-- Sets updated_at/updated_by(_login) on every change and created_by(_login)
-- on insert; needs SECURITY DEFINER to read portal_users.login (RLS on that
-- table has no SELECT policy for `authenticated` at all), same reasoning as
-- log_staffing_demand_change() in 20260724130000_create_staffing_demand_history.sql.
create function public.set_addresses_audit_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.portal_current_user_id();
  v_login text;
begin
  if v_uid is not null then
    select login into v_login from public.portal_users where id = v_uid;
  end if;

  if tg_op = 'INSERT' then
    new.created_by := v_uid;
    new.created_by_login := v_login;
  else
    new.created_by := old.created_by;
    new.created_by_login := old.created_by_login;
  end if;

  new.updated_by := v_uid;
  new.updated_by_login := v_login;
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_addresses_set_audit_fields
  before insert or update on public.addresses
  for each row
  execute function public.set_addresses_audit_fields();

-- Indexes for filtering/sorting; full_address gets a trigram index for
-- substring search (pg_trgm is already enabled by the candidates migration).
create index idx_addresses_project on public.addresses (project);
create index idx_addresses_city on public.addresses (city);
create index idx_addresses_position on public.addresses (position);
create index idx_addresses_status on public.addresses (status);
create index idx_addresses_priority on public.addresses (priority);
create index idx_addresses_object_type on public.addresses (object_type);
create index idx_addresses_district on public.addresses (district);
create index idx_addresses_metro on public.addresses (metro);
create index idx_addresses_archived_at on public.addresses (archived_at);
create index idx_addresses_full_address_trgm on public.addresses using gin (full_address gin_trgm_ops);

alter table public.addresses enable row level security;
-- No policies yet on purpose — see 20260729130100_addresses_rls_policies.sql,
-- same two-step pattern as public.candidates.
