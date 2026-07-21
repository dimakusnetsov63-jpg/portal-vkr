-- Candidates schema for the "Кандидаты" section.
-- Creates the candidates table with restricted project/stage vocabularies,
-- search-friendly indexes and an updated_at trigger. Row Level Security is
-- enabled with NO policies: until staff authentication exists, the table is
-- reachable only via the service_role key (used server-side only, never in
-- the browser), which bypasses RLS entirely. Do not add anon/permissive
-- policies here — see the migration notes at the bottom of this file.

-- Trigram search on full_name (candidate search by name).
create extension if not exists pg_trgm;

-- Allowed projects (exact names as supplied by the business, not renamed).
create type public.candidate_project as enum (
  'Самокат',
  'Купер',
  'ДонатсКофе',
  'Яндекс Лавка',
  'Яндекс РБ',
  'Газпромнефть',
  'Евроторг',
  'Мастер Деливери',
  'Мастер Деливери Таксопарк',
  'Азбука вкуса',
  'Бургер кинг Россия',
  'Далли'
);

-- Allowed recruiting stages. NULL means the candidate has not yet reached
-- the first tracked stage.
create type public.candidate_stage as enum (
  'Прибыл на проект',
  'Отработал 1 смену',
  'Отработал 10 смен',
  'Завершил вахту'
);

create table public.candidates (
  -- Internal identifier, never shown to end users as "the" candidate ID.
  id uuid primary key default gen_random_uuid(),

  -- Business-facing candidate ID, entered by hand. Free text, not unique:
  -- source systems may contain duplicate or missing IDs.
  external_id text,

  -- Full name as a single free-text field (not split into parts).
  full_name text not null,

  -- Project the candidate is assigned to. Restricted via enum.
  project public.candidate_project not null,

  city text,

  -- Recruiting stage. Restricted via enum; nullable until reached.
  stage public.candidate_stage,

  recruiter text,
  manager text,
  coordinator text,
  source text,

  -- Free-text contact details. Phone stays text: it may contain "+",
  -- spaces, parentheses, dashes and an extension, and is not unique.
  phone text,
  telegram_tag text,
  max_tag text,

  comment text,

  -- true = есть, false = нет, null = не указано.
  has_medical_book boolean,

  -- Free text: "Сбер", "карта оформляется", "нет карты", etc. No fixed
  -- list of banks.
  salary_card text,

  invitation_at timestamptz,
  registration_at timestamptz,
  first_shift_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Soft-delete marker. Active candidates are rows where archived_at is
  -- null; candidates are never physically deleted by default.
  archived_at timestamptz
);

comment on table public.candidates is
  'Кандидаты, отслеживаемые в разделе «Кандидаты». Soft-delete через archived_at, физическое удаление не используется.';
comment on column public.candidates.external_id is 'Бизнес-ID кандидата, вводится вручную. Не уникален, не является primary key.';
comment on column public.candidates.has_medical_book is 'true = есть, false = нет, null = не указано.';
comment on column public.candidates.archived_at is 'NULL = активный кандидат. Заполнено = архивирован (soft delete).';

-- Keep updated_at current on every row change.
create function public.set_candidates_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_candidates_set_updated_at
  before update on public.candidates
  for each row
  execute function public.set_candidates_updated_at();

-- Indexes for filtering and sorting.
create index idx_candidates_project on public.candidates (project);
create index idx_candidates_stage on public.candidates (stage);
create index idx_candidates_city on public.candidates (city);
create index idx_candidates_recruiter on public.candidates (recruiter);
create index idx_candidates_manager on public.candidates (manager);
create index idx_candidates_coordinator on public.candidates (coordinator);
create index idx_candidates_invitation_at on public.candidates (invitation_at);
create index idx_candidates_registration_at on public.candidates (registration_at);
create index idx_candidates_first_shift_at on public.candidates (first_shift_at);
create index idx_candidates_created_at on public.candidates (created_at);
create index idx_candidates_archived_at on public.candidates (archived_at);
create index idx_candidates_phone on public.candidates (phone);
create index idx_candidates_telegram_tag on public.candidates (telegram_tag);
create index idx_candidates_max_tag on public.candidates (max_tag);
create index idx_candidates_has_medical_book on public.candidates (has_medical_book);

-- Trigram index for fuzzy/partial search by full name.
create index idx_candidates_full_name_trgm on public.candidates using gin (full_name gin_trgm_ops);

-- Row Level Security --------------------------------------------------
-- Enabled with zero policies on purpose: with RLS on and no policies,
-- anon and authenticated roles get NO access (default-deny). Only
-- service_role (server-side only) can read/write, bypassing RLS.
alter table public.candidates enable row level security;

-- NOTE for the next stage (once staff authentication is implemented):
-- Add explicit, scoped policies here, for example:
--   * SELECT for role = 'authenticated' filtered to non-archived rows
--     (or all rows for roles that need archive access), never `using (true)`.
--   * INSERT/UPDATE restricted to authenticated staff roles, with
--     `with check` clauses tied to the authenticated user/claims — never
--     `with check (true)`.
--   * Consider row-level scoping by recruiter/manager/coordinator if staff
--     should only see their own candidates.
--   * Do not add an `anon` policy for this table.
