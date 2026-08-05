-- External-link attachments (no Supabase Storage in this project — same
-- constraint as public.addresses.document_links). Attached to the vacancy
-- (always required) with an OPTIONAL section: a document can live inside
-- e.g. "Оформление"'s own card, or stay general to the whole vacancy
-- (section_id is null). If its section is deleted, the attachment is not
-- deleted with it — `section_id` just falls back to null, i.e. general —
-- deliberately different from vacancy_fields, which has no meaning outside
-- its section and is cascade-deleted with it.
--
-- Row Level Security is enabled with NO policies here — see
-- 20260805100500_vacancy_projects_rls_policies.sql.

create table public.vacancy_attachments (
  id uuid primary key default gen_random_uuid(),
  vacancy_project_id uuid not null references public.vacancy_projects (id) on delete cascade,
  section_id uuid references public.vacancy_sections (id) on delete set null,

  title text not null check (char_length(btrim(title)) > 0),
  url text not null check (url ~ '^https?://'),
  type text not null default 'link' check (type in ('pdf', 'google_doc', 'video', 'link')),

  sort_order integer not null default 0,

  created_at timestamptz not null default now()
);

comment on table public.vacancy_attachments is
  'Внешние ссылки-вложения вакансии (PDF/Google Docs/видео/произвольная ссылка). Привязаны к вакансии, привязка к разделу необязательна.';
comment on column public.vacancy_attachments.section_id is
  'NULL = общее вложение вакансии, показывается в общем блоке «Вложения». При удалении раздела становится NULL, а не удаляется вместе с ним.';

create index idx_vacancy_attachments_project_id on public.vacancy_attachments (vacancy_project_id, sort_order);
create index idx_vacancy_attachments_section_id on public.vacancy_attachments (section_id, sort_order);

alter table public.vacancy_attachments enable row level security;
-- No policies yet on purpose — see 20260805100500_vacancy_projects_rls_policies.sql.
