-- Schema for the reworked "Описание вакансии" section: real, editable
-- Supabase data instead of the static, hand-generated
-- src/lib/portal/vacancyData.ts (see TASK-010 for the full rationale).
--
-- public.vacancy_projects is the root row of a vacancy. Everything that used
-- to be "Профиль"/"Регион работы"/"Период работы"/"Должность в Битрикс"/
-- ссылка на описание in the old static file is NOT a column here — those
-- live as ordinary rows in public.vacancy_fields, inside the system section
-- "Общая информация" that public.vacancy_sections seeds for every project
-- (see 20260805100100_create_vacancy_sections.sql). One editing mechanism
-- for both system and custom fields, not two.
--
-- No `slug` column: the old static file had one only because it needed a
-- stable client-side selection key for data with no real id. A DB row
-- already has that key — its `id` — so a slug would be redundant surface
-- area with a transliteration/uniqueness problem of its own.
--
-- Row Level Security is enabled with NO policies here — policies are added
-- in 20260805100500_vacancy_projects_rls_policies.sql, the same two-step
-- pattern as public.candidates / public.addresses.

create table public.vacancy_projects (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) > 0),

  -- Real FK, unlike project/city/position elsewhere in the portal (those are
  -- free text with candidate_list_options only as a suggestion source).
  -- candidate_list_options rows are never physically deleted (only
  -- deactivated via is_active = false — see 20260722214949), so this FK
  -- never risks pointing at a row that vanished from under it;
  -- `on delete set null` is only a guard against manual DB intervention,
  -- not a path the application ever takes.
  category_option_id uuid references public.candidate_list_options (id) on delete set null,

  -- Optimistic concurrency: the client reads `version` when it opens a
  -- vacancy for editing and passes it back to
  -- public.portal_save_vacancy_project_tree(); a mismatch there means
  -- someone else saved in between, and the save is rejected instead of
  -- silently overwriting their change. Plain updates outside that RPC
  -- (archive/restore, direct title/category edits) do not check `version` —
  -- the collision this guards against is two people editing the section/
  -- field tree at once, not a rename racing an archive.
  version integer not null default 1,

  -- Soft-delete for the whole vacancy, same convention as public.addresses/
  -- public.candidates. Archiving one section within a vacancy is a
  -- different, independent action — see vacancy_sections.archived_at.
  archived_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Snapshot "who/when" in the row itself, same trick as public.addresses/
  -- public.rate_cards: `*_login` is a text copy because public.portal_users
  -- is fully RLS-closed for `authenticated` — a client-side join could never
  -- resolve the name.
  created_by uuid references public.portal_users (id) on delete set null,
  created_by_login text,
  updated_by uuid references public.portal_users (id) on delete set null,
  updated_by_login text
);

comment on table public.vacancy_projects is
  'Корень вакансии для раздела «Описание вакансии». Профиль/регион/период/ссылка на описание и т.п. — не колонки, а поля внутри системного раздела «Общая информация» (public.vacancy_sections/vacancy_fields).';
comment on column public.vacancy_projects.category_option_id is
  'FK на candidate_list_options (list_type = vacancy_category, добавляется миграцией 20260805100700). В отличие от project/city/position в остальных разделах — настоящий FK, не свободный текст: справочник никогда не удаляется физически, только деактивируется.';
comment on column public.vacancy_projects.version is
  'Оптимистическая блокировка для public.portal_save_vacancy_project_tree — см. комментарий у функции.';

-- Sets updated_at/updated_by(_login) on every change and created_by(_login)
-- on insert; needs SECURITY DEFINER to read portal_users.login (that table
-- has no SELECT policy for `authenticated` at all), same reasoning as
-- public.set_addresses_audit_fields()/public.set_rates_audit_fields().
create function public.set_vacancy_projects_audit_fields()
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

create trigger trg_vacancy_projects_set_audit_fields
  before insert or update on public.vacancy_projects
  for each row
  execute function public.set_vacancy_projects_audit_fields();

create index idx_vacancy_projects_category_option_id on public.vacancy_projects (category_option_id);
create index idx_vacancy_projects_archived_at on public.vacancy_projects (archived_at);
-- pg_trgm already enabled by the candidates migration; used by
-- public.search_vacancy_projects (20260805100600) for substring search.
create index idx_vacancy_projects_title_trgm on public.vacancy_projects using gin (title gin_trgm_ops);

alter table public.vacancy_projects enable row level security;
-- No policies yet on purpose — see 20260805100500_vacancy_projects_rls_policies.sql.
