-- RLS policies for public.staffing_demand. Same trust model as
-- public.candidates: any authenticated Supabase staff account (no
-- self-service signup) can read and write. No `anon` policy.
--
-- Unlike candidates/candidate_list_options, this table DOES get a delete
-- policy: clearing a demand cell is a real physical delete (see the create
-- migration's comment — there is no archived_at column here), so
-- `authenticated` needs delete rights to make that work.

create policy "authenticated_select_staffing_demand"
  on public.staffing_demand
  for select
  to authenticated
  using (true);

create policy "authenticated_insert_staffing_demand"
  on public.staffing_demand
  for insert
  to authenticated
  with check (true);

create policy "authenticated_update_staffing_demand"
  on public.staffing_demand
  for update
  to authenticated
  using (true)
  with check (true);

create policy "authenticated_delete_staffing_demand"
  on public.staffing_demand
  for delete
  to authenticated
  using (true);
