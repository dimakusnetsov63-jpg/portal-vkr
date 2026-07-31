-- RLS-политики для public.rate_cards и public.rates. Та же модель доверия,
-- что у остального портала после 20260728120000_portal_auth.sql: доступ
-- открывает `public.portal_can('rates')`, а не безусловное `using (true)`.
--
-- В отличие от public.candidates и public.addresses здесь есть настоящая
-- DELETE-политика: у «Ставок» нет архива — ТЗ раздела требует именно
-- удаления записи. По той же причине DELETE есть у public.staffing_demand.
--
-- Удаление блока каскадом уносит его строки (FK on delete cascade). Каскад
-- выполняется от имени вызывающего и проверяется политикой DELETE на
-- public.rates — поэтому она нужна, даже если интерфейс удаляет строки
-- только по одной.

create policy "portal_select_rate_cards"
  on public.rate_cards for select to authenticated
  using (public.portal_can('rates'));

create policy "portal_insert_rate_cards"
  on public.rate_cards for insert to authenticated
  with check (public.portal_can('rates'));

create policy "portal_update_rate_cards"
  on public.rate_cards for update to authenticated
  using (public.portal_can('rates'))
  with check (public.portal_can('rates'));

create policy "portal_delete_rate_cards"
  on public.rate_cards for delete to authenticated
  using (public.portal_can('rates'));

create policy "portal_select_rates"
  on public.rates for select to authenticated
  using (public.portal_can('rates'));

create policy "portal_insert_rates"
  on public.rates for insert to authenticated
  with check (public.portal_can('rates'));

create policy "portal_update_rates"
  on public.rates for update to authenticated
  using (public.portal_can('rates'))
  with check (public.portal_can('rates'));

create policy "portal_delete_rates"
  on public.rates for delete to authenticated
  using (public.portal_can('rates'));
