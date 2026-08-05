-- RLS policies for the vacancy_projects/vacancy_sections/vacancy_fields/
-- vacancy_attachments tables. Same trust model as the rest of the portal
-- (public.portal_can(...)), with one addition: write access is narrower
-- than read access here. "Описание вакансии" is visible to all four roles
-- (portal_role_sections already lists 'vacancies' for head/coordinator/
-- manager/recruiter), but editing content is head/coordinator-only —
-- gated by `and public.portal_can('settings')`, the exact same trick
-- public.candidate_list_options already uses for the same split (only
-- head/coordinator have the 'settings' section — see roles.ts), rather than
-- inventing a second, parallel way to check "is this an admin role".
--
-- vacancy_projects itself has no DELETE policy — soft-delete via
-- archived_at only, like public.addresses. The three child tables DO have
-- DELETE: removing a field/section/attachment is a real row delete (its
-- own history survives in vacancy_history via the triggers in
-- 20260805100400), not a soft-delete concern.
--
-- These policies are the fallback path for direct PostgREST access; the
-- primary way the UI edits a vacancy's tree is the
-- public.portal_save_vacancy_project_tree RPC (20260805100600), which
-- checks the same two conditions itself before doing anything.

create policy "portal_select_vacancy_projects"
  on public.vacancy_projects for select to authenticated
  using (public.portal_can('vacancies'));

create policy "portal_insert_vacancy_projects"
  on public.vacancy_projects for insert to authenticated
  with check (public.portal_can('vacancies') and public.portal_can('settings'));

create policy "portal_update_vacancy_projects"
  on public.vacancy_projects for update to authenticated
  using (public.portal_can('vacancies') and public.portal_can('settings'))
  with check (public.portal_can('vacancies') and public.portal_can('settings'));

create policy "portal_select_vacancy_sections"
  on public.vacancy_sections for select to authenticated
  using (public.portal_can('vacancies'));

create policy "portal_insert_vacancy_sections"
  on public.vacancy_sections for insert to authenticated
  with check (public.portal_can('vacancies') and public.portal_can('settings'));

create policy "portal_update_vacancy_sections"
  on public.vacancy_sections for update to authenticated
  using (public.portal_can('vacancies') and public.portal_can('settings'))
  with check (public.portal_can('vacancies') and public.portal_can('settings'));

create policy "portal_delete_vacancy_sections"
  on public.vacancy_sections for delete to authenticated
  using (public.portal_can('vacancies') and public.portal_can('settings'));

create policy "portal_select_vacancy_fields"
  on public.vacancy_fields for select to authenticated
  using (public.portal_can('vacancies'));

create policy "portal_insert_vacancy_fields"
  on public.vacancy_fields for insert to authenticated
  with check (public.portal_can('vacancies') and public.portal_can('settings'));

create policy "portal_update_vacancy_fields"
  on public.vacancy_fields for update to authenticated
  using (public.portal_can('vacancies') and public.portal_can('settings'))
  with check (public.portal_can('vacancies') and public.portal_can('settings'));

create policy "portal_delete_vacancy_fields"
  on public.vacancy_fields for delete to authenticated
  using (public.portal_can('vacancies') and public.portal_can('settings'));

create policy "portal_select_vacancy_attachments"
  on public.vacancy_attachments for select to authenticated
  using (public.portal_can('vacancies'));

create policy "portal_insert_vacancy_attachments"
  on public.vacancy_attachments for insert to authenticated
  with check (public.portal_can('vacancies') and public.portal_can('settings'));

create policy "portal_update_vacancy_attachments"
  on public.vacancy_attachments for update to authenticated
  using (public.portal_can('vacancies') and public.portal_can('settings'))
  with check (public.portal_can('vacancies') and public.portal_can('settings'));

create policy "portal_delete_vacancy_attachments"
  on public.vacancy_attachments for delete to authenticated
  using (public.portal_can('vacancies') and public.portal_can('settings'));
