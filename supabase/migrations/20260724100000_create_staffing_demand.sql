-- Staffing demand ("Потребность") schema for the reworked Потребность section.
-- One row = planned headcount need for one (project, city) on one calendar
-- day. No fact/fulfillment/deficit/candidate-linkage in this phase —
-- headcount planning only.
--
-- Unlike candidates/candidate_list_options, this table does NOT use
-- soft-delete: a demand value is either updated in place (upsert) or the row
-- is physically deleted when a cell is cleared back to "not set". A demand
-- entry carries no historical/audit value once removed, so a plain unique
-- constraint (not a partial index gated on archived_at) is used — this keeps
-- the Supabase-JS `.upsert(...).onConflict(...)` path predictable, which a
-- partial unique index does not reliably guarantee via PostgREST.

create table public.staffing_demand (
  id uuid primary key default gen_random_uuid(),

  -- Project the demand applies to. Reuses the existing enum from
  -- candidates — no separate project vocabulary for this table.
  project public.candidate_project not null,

  -- Free text, matching candidates.city: curated via candidate_list_options
  -- (list_type = 'city') but NOT foreign-keyed to it, same trust model as
  -- candidates.city.
  city text not null,

  demand_date date not null,

  -- Planned headcount need for this project/city/day. "Not set" is modeled
  -- as "no row", never as 0 — 0 is a valid, explicit value (no need).
  planned_count integer not null check (planned_count >= 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (project, city, demand_date)
);

comment on table public.staffing_demand is
  'Плановая потребность в персонале по проекту/городу/дню для раздела «Потребность». Нет soft-delete: очистка ячейки — физическое удаление строки, значение обновляется обычным upsert.';
comment on column public.staffing_demand.city is
  'Свободный текст, без FK на candidate_list_options (как candidates.city) — подсказки курируются отдельно, не ограничивают значение.';
comment on column public.staffing_demand.planned_count is
  'Плановая численность на дату. Отсутствие строки = "не задано" (не путать с 0).';

-- Reuse the existing trigger function from the candidates migration — it is
-- generic (operates on NEW.updated_at), not table-specific.
create trigger trg_staffing_demand_set_updated_at
  before update on public.staffing_demand
  for each row
  execute function public.set_candidates_updated_at();

-- Indexes for the section's query patterns: "load one window of dates"
-- (range scan on demand_date) and matrix grouping by project/city.
create index idx_staffing_demand_demand_date on public.staffing_demand (demand_date);
create index idx_staffing_demand_project on public.staffing_demand (project);
create index idx_staffing_demand_city on public.staffing_demand (city);

-- Row Level Security --------------------------------------------------
-- Enabled here with no policies yet — see the follow-up migration, which
-- adds authenticated-only policies immediately (staff auth already exists
-- in this codebase, unlike the very first candidates migration).
alter table public.staffing_demand enable row level security;
