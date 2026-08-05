-- A vacancy's content is split into sections the user names and orders
-- freely — not a fixed set of ~10 categories. `template`/hardcoded group
-- enums were deliberately rejected: the business is expected to invent
-- sections ("Обучение", "FAQ", "Памятка координатору") that don't fit any
-- fixed taxonomy, and a CHECK on the set of allowed titles would force a
-- migration every time that happens.
--
-- `is_system` is the one functional flag: exactly one section per project —
-- "Общая информация", created by vacancyProjectsRepo.createVacancyProject —
-- is system. It cannot be deleted or moved from the first position (enforced
-- in public.portal_save_vacancy_project_tree, not by a DB constraint, since
-- there is nothing structurally wrong with a second is_system row existing —
-- the application simply never creates one).
--
-- Row Level Security is enabled with NO policies here — see
-- 20260805100500_vacancy_projects_rls_policies.sql.

create table public.vacancy_sections (
  id uuid primary key default gen_random_uuid(),
  vacancy_project_id uuid not null references public.vacancy_projects (id) on delete cascade,

  title text not null check (char_length(btrim(title)) > 0),

  -- IconName chosen by whoever creates the section (src/components/portal/ui/Icon.tsx).
  -- Cosmetic only — renaming/retyping never breaks anything.
  icon text,

  is_system boolean not null default false,

  -- Manual order, adjusted via ↑/↓ in the editor (no drag-and-drop library
  -- in this project) — same convention as candidate_list_options.sort_order.
  sort_order integer not null default 0,

  -- Archiving ONE section, independent of the whole vacancy
  -- (vacancy_projects.archived_at is a separate, whole-vacancy action).
  archived_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.vacancy_sections is
  'Разделы вакансии («Общая информация», «График работы», «Обучение», …) — полностью произвольные, без фиксированного набора. is_system=true только у автосозданной «Общая информация».';
comment on column public.vacancy_sections.is_system is
  'true только у «Общая информация», создаётся один раз при создании вакансии. Нельзя удалить/увести с первого места — проверяется в portal_save_vacancy_project_tree, не CHECK-ограничением.';

create trigger trg_vacancy_sections_set_updated_at
  before update on public.vacancy_sections
  for each row
  execute function public.set_candidates_updated_at();

create index idx_vacancy_sections_project_id on public.vacancy_sections (vacancy_project_id, sort_order);
create index idx_vacancy_sections_archived_at on public.vacancy_sections (archived_at);
-- Used by public.search_vacancy_projects (20260805100600).
create index idx_vacancy_sections_title_trgm on public.vacancy_sections using gin (title gin_trgm_ops);

alter table public.vacancy_sections enable row level security;
-- No policies yet on purpose — see 20260805100500_vacancy_projects_rls_policies.sql.
