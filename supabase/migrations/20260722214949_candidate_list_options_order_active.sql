-- Ordering + soft-deactivation for candidate_list_options.
-- Values are never physically deleted from here on (matches the
-- candidates table's own philosophy): "removing" a suggestion means
-- setting is_active = false. Inactive values disappear from the
-- datalist suggestions but stay in the table, so candidates that were
-- already saved with that value are completely unaffected (this table
-- only curates suggestions — it has never constrained what
-- candidates.recruiter/manager/coordinator/city can store).

alter table public.candidate_list_options
  add column sort_order integer not null default 0,
  add column is_active boolean not null default true;

comment on column public.candidate_list_options.sort_order is
  'Manual display order within a list_type (lower = earlier). Adjusted via up/down reordering in Settings.';
comment on column public.candidate_list_options.is_active is
  'false = hidden from datalist suggestions but kept in the table. Never physically delete rows here.';

-- Backfill sort_order for any rows created before this column existed,
-- so ordering is stable per list_type from the start.
with ordered as (
  select id, row_number() over (partition by list_type order by value) as rn
  from public.candidate_list_options
)
update public.candidate_list_options c
set sort_order = ordered.rn
from ordered
where ordered.id = c.id;

create index idx_candidate_list_options_list_type_sort
  on public.candidate_list_options (list_type, sort_order);

-- No physical delete, ever: drop the delete policy added in the previous
-- migration. Deactivation goes through the existing update policy.
drop policy if exists "authenticated_delete_candidate_list_options" on public.candidate_list_options;
