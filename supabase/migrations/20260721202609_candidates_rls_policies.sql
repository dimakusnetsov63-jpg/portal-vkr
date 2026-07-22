-- RLS policies for public.candidates now that staff authentication exists.
-- Scope: any authenticated Supabase user (an internal staff account,
-- provisioned manually in the Dashboard — there is no self-service signup)
-- can read and write candidates. `using (true)`/`with check (true)` here
-- are intentional and safe: they only apply to the `authenticated` role,
-- never `anon`, so unauthenticated access remains fully denied by default.
-- No delete policy: candidates are archived via `archived_at`, never
-- physically deleted.

create policy "authenticated_select_candidates"
  on public.candidates
  for select
  to authenticated
  using (true);

create policy "authenticated_insert_candidates"
  on public.candidates
  for insert
  to authenticated
  with check (true);

create policy "authenticated_update_candidates"
  on public.candidates
  for update
  to authenticated
  using (true)
  with check (true);
