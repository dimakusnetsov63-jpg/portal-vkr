-- Row-level metadata (status + comment) for one project+city "row" in the
-- «Потребность» matrix — independent of any specific date. Separate from
-- the per-date headcount values in public.staffing_demand.
--
-- Not created eagerly for every visible row: a metadata row only exists
-- once a coordinator sets a non-default status or a comment for that
-- project+city pair. Absence of a row means "active, no comment" — the
-- UI default (see src/components/portal/sections/demand/demandRowMeta.ts).

create table public.staffing_demand_rows (
  id uuid primary key default gen_random_uuid(),

  -- Free text here, not the candidate_project enum — this table's
  -- project/city are plain text by design (unlike staffing_demand.project).
  project text not null,
  city text not null,

  status text not null default 'active',
  comment text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (project, city),
  constraint staffing_demand_rows_status_check
    check (status in ('active', 'paused', 'closed')),
  constraint staffing_demand_rows_comment_length_check
    check (comment is null or char_length(comment) <= 2000)
);

comment on table public.staffing_demand_rows is
  'Метаданные строки «проект+город» в разделе «Потребность»: статус и комментарий, не привязанные к дате. Значения по датам — отдельно, в public.staffing_demand. Запись создаётся только при первом изменении статуса/комментария; её отсутствие = active + пустой комментарий.';
comment on column public.staffing_demand_rows.status is
  'active | paused | closed — через CHECK, а не enum, чтобы список было проще расширить позже.';
comment on column public.staffing_demand_rows.comment is
  'NULL = не задан. Пустая строка не сохраняется — приложение приводит "" к NULL перед записью (см. demandRowMeta.ts normalizeComment). Максимум 2000 символов — продублировано CHECK-ограничением на случай прямой записи в обход приложения.';

-- Reuse the existing generic trigger function (already used by candidates
-- and staffing_demand) — not table-specific.
create trigger trg_staffing_demand_rows_set_updated_at
  before update on public.staffing_demand_rows
  for each row
  execute function public.set_candidates_updated_at();

create index idx_staffing_demand_rows_project on public.staffing_demand_rows (project);
create index idx_staffing_demand_rows_city on public.staffing_demand_rows (city);
create index idx_staffing_demand_rows_status on public.staffing_demand_rows (status);

-- Row Level Security --------------------------------------------------
-- Same trust model as the rest of the schema: any authenticated Supabase
-- staff account can read/write. No delete policy — metadata rows are never
-- deleted by the app (clearing a comment sets it to NULL via UPDATE, it
-- never removes the row); matches the no-hard-delete precedent already
-- used for candidate_list_options.
alter table public.staffing_demand_rows enable row level security;

create policy "authenticated_select_staffing_demand_rows"
  on public.staffing_demand_rows for select to authenticated using (true);

create policy "authenticated_insert_staffing_demand_rows"
  on public.staffing_demand_rows for insert to authenticated with check (true);

create policy "authenticated_update_staffing_demand_rows"
  on public.staffing_demand_rows for update to authenticated
  using (true) with check (true);
