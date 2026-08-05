-- A field is a plain "label -> value" pair inside a vacancy_sections row —
-- the same shape the source Excel used, just as real, searchable, orderable
-- rows instead of a flat sheet dump.
--
-- Row Level Security is enabled with NO policies here — see
-- 20260805100500_vacancy_projects_rls_policies.sql.

create table public.vacancy_fields (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.vacancy_sections (id) on delete cascade,

  label text not null default '',
  value text not null default '',

  -- Widened to the full set up front so a future type never needs a schema
  -- migration — see docs/requirements/vacancies.md for which of these the
  -- editor actually implements today ('select' is reserved, not yet built:
  -- it would need its own source of options, decided separately).
  field_type text not null default 'text'
    check (field_type in ('text', 'textarea', 'rich_text', 'link', 'number', 'date', 'checkbox', 'select')),

  sort_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.vacancy_fields is
  'Поле «подпись -> значение» внутри раздела вакансии. field_type определяет редактор/рендер на фронте — см. renderFieldValue.ts.';
comment on column public.vacancy_fields.field_type is
  'text/textarea/rich_text/link/number/date/checkbox реализованы; select зарезервирован в схеме, редактор пока не построен (нет источника вариантов).';

create trigger trg_vacancy_fields_set_updated_at
  before update on public.vacancy_fields
  for each row
  execute function public.set_candidates_updated_at();

create index idx_vacancy_fields_section_id on public.vacancy_fields (section_id, sort_order);
-- Used by public.search_vacancy_projects (20260805100600).
create index idx_vacancy_fields_label_trgm on public.vacancy_fields using gin (label gin_trgm_ops);
create index idx_vacancy_fields_value_trgm on public.vacancy_fields using gin (value gin_trgm_ops);

alter table public.vacancy_fields enable row level security;
-- No policies yet on purpose — see 20260805100500_vacancy_projects_rls_policies.sql.
