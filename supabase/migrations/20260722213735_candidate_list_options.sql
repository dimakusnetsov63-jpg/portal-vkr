-- Managed dropdown/suggestion lists for the free-text candidate fields
-- (recruiter, manager, coordinator, city). Editable from Settings.
-- Deliberately excludes "project": that's a fixed enum on public.candidates
-- (public.candidate_project) and changing it is a schema migration, not a
-- simple reference-list edit.

create type public.candidate_list_type as enum ('recruiter', 'manager', 'coordinator', 'city');

create table public.candidate_list_options (
  id uuid primary key default gen_random_uuid(),
  list_type public.candidate_list_type not null,
  value text not null,
  created_at timestamptz not null default now(),
  unique (list_type, value)
);

comment on table public.candidate_list_options is
  'Editable suggestion values for candidates.recruiter/manager/coordinator/city (free-text fields — this table only curates datalist suggestions, it does not constrain what candidates.* can store).';

create index idx_candidate_list_options_list_type on public.candidate_list_options (list_type);

-- Row Level Security --------------------------------------------------
-- Same trust model as public.candidates: any authenticated staff account
-- (no self-service signup) can manage these lists. No anon access. Unlike
-- candidates, hard delete is fine here — these are just suggestion values,
-- not records that need an audit trail.
alter table public.candidate_list_options enable row level security;

create policy "authenticated_select_candidate_list_options"
  on public.candidate_list_options
  for select
  to authenticated
  using (true);

create policy "authenticated_insert_candidate_list_options"
  on public.candidate_list_options
  for insert
  to authenticated
  with check (true);

create policy "authenticated_update_candidate_list_options"
  on public.candidate_list_options
  for update
  to authenticated
  using (true)
  with check (true);

create policy "authenticated_delete_candidate_list_options"
  on public.candidate_list_options
  for delete
  to authenticated
  using (true);
