-- H-6 (docs/AUDIT-2026-07-31.md), фаза C — включение проектного фильтра.
--
-- Требует фазы A (portal_has_project/portal_has_rate_card_project уже
-- существуют — миграция 20260803130000) и пройденной фазы B (read-only
-- аудит покрытия проектов, docs/ROLLOUT-project-access.md). Точные
-- определения политик до этой миграции сохранены там же, в разделе
-- Backup — это и есть скрипт отката.
--
-- portal_can(<раздел>) не меняется и не переписывается — проверка проекта
-- добавляется через `and`, поверх существующей секционной проверки, а не
-- вместо неё.
--
-- head проходит portal_has_project/portal_has_rate_card_project всегда
-- (см. определение функций) — для этой роли ничего не меняется практически,
-- хотя формально условие в политике то же самое, что и для остальных ролей.

-- === candidates ===
drop policy "portal_select_candidates" on public.candidates;
drop policy "portal_insert_candidates" on public.candidates;
drop policy "portal_update_candidates" on public.candidates;

create policy "portal_select_candidates"
  on public.candidates for select to authenticated
  using (public.portal_can('candidates') and public.portal_has_project(project));
create policy "portal_insert_candidates"
  on public.candidates for insert to authenticated
  with check (public.portal_can('candidates') and public.portal_has_project(project));
create policy "portal_update_candidates"
  on public.candidates for update to authenticated
  using (public.portal_can('candidates') and public.portal_has_project(project))
  with check (public.portal_can('candidates') and public.portal_has_project(project));

-- === staffing_demand ===
drop policy "portal_select_staffing_demand" on public.staffing_demand;
drop policy "portal_insert_staffing_demand" on public.staffing_demand;
drop policy "portal_update_staffing_demand" on public.staffing_demand;
drop policy "portal_delete_staffing_demand" on public.staffing_demand;

create policy "portal_select_staffing_demand"
  on public.staffing_demand for select to authenticated
  using (public.portal_can('demand') and public.portal_has_project(project));
create policy "portal_insert_staffing_demand"
  on public.staffing_demand for insert to authenticated
  with check (public.portal_can('demand') and public.portal_has_project(project));
create policy "portal_update_staffing_demand"
  on public.staffing_demand for update to authenticated
  using (public.portal_can('demand') and public.portal_has_project(project))
  with check (public.portal_can('demand') and public.portal_has_project(project));
create policy "portal_delete_staffing_demand"
  on public.staffing_demand for delete to authenticated
  using (public.portal_can('demand') and public.portal_has_project(project));

-- === staffing_demand_rows ===
-- Своя колонка project, независимая от staffing_demand.project буквально
-- (см. schema.md), но семантика доступа та же — проверяется её собственное
-- значение, не значение из родительской строки staffing_demand.
drop policy "portal_select_staffing_demand_rows" on public.staffing_demand_rows;
drop policy "portal_insert_staffing_demand_rows" on public.staffing_demand_rows;
drop policy "portal_update_staffing_demand_rows" on public.staffing_demand_rows;

create policy "portal_select_staffing_demand_rows"
  on public.staffing_demand_rows for select to authenticated
  using (public.portal_can('demand') and public.portal_has_project(project));
create policy "portal_insert_staffing_demand_rows"
  on public.staffing_demand_rows for insert to authenticated
  with check (public.portal_can('demand') and public.portal_has_project(project));
create policy "portal_update_staffing_demand_rows"
  on public.staffing_demand_rows for update to authenticated
  using (public.portal_can('demand') and public.portal_has_project(project))
  with check (public.portal_can('demand') and public.portal_has_project(project));

-- === staffing_demand_history (select-only — insert/update/delete не
-- существуют, пишет только SECURITY DEFINER-триггер, RLS его не касается) ===
drop policy "portal_select_staffing_demand_history" on public.staffing_demand_history;

create policy "portal_select_staffing_demand_history"
  on public.staffing_demand_history for select to authenticated
  using (public.portal_can('demand') and public.portal_has_project(project));

-- === addresses ===
drop policy "portal_select_addresses" on public.addresses;
drop policy "portal_insert_addresses" on public.addresses;
drop policy "portal_update_addresses" on public.addresses;

create policy "portal_select_addresses"
  on public.addresses for select to authenticated
  using (public.portal_can('addresses') and public.portal_has_project(project));
create policy "portal_insert_addresses"
  on public.addresses for insert to authenticated
  with check (public.portal_can('addresses') and public.portal_has_project(project));
create policy "portal_update_addresses"
  on public.addresses for update to authenticated
  using (public.portal_can('addresses') and public.portal_has_project(project))
  with check (public.portal_can('addresses') and public.portal_has_project(project));

-- === rate_cards ===
drop policy "portal_select_rate_cards" on public.rate_cards;
drop policy "portal_insert_rate_cards" on public.rate_cards;
drop policy "portal_update_rate_cards" on public.rate_cards;
drop policy "portal_delete_rate_cards" on public.rate_cards;

create policy "portal_select_rate_cards"
  on public.rate_cards for select to authenticated
  using (public.portal_can('rates') and public.portal_has_project(project));
create policy "portal_insert_rate_cards"
  on public.rate_cards for insert to authenticated
  with check (public.portal_can('rates') and public.portal_has_project(project));
create policy "portal_update_rate_cards"
  on public.rate_cards for update to authenticated
  using (public.portal_can('rates') and public.portal_has_project(project))
  with check (public.portal_can('rates') and public.portal_has_project(project));
create policy "portal_delete_rate_cards"
  on public.rate_cards for delete to authenticated
  using (public.portal_can('rates') and public.portal_has_project(project));

-- === rates ===
-- Нет собственной колонки project — только rate_card_id (FK на rate_cards).
-- portal_has_rate_card_project делает join внутри себя один раз, вместо
-- повторения join-выражения в каждой из четырёх политик.
drop policy "portal_select_rates" on public.rates;
drop policy "portal_insert_rates" on public.rates;
drop policy "portal_update_rates" on public.rates;
drop policy "portal_delete_rates" on public.rates;

create policy "portal_select_rates"
  on public.rates for select to authenticated
  using (public.portal_can('rates') and public.portal_has_rate_card_project(rate_card_id));
create policy "portal_insert_rates"
  on public.rates for insert to authenticated
  with check (public.portal_can('rates') and public.portal_has_rate_card_project(rate_card_id));
create policy "portal_update_rates"
  on public.rates for update to authenticated
  using (public.portal_can('rates') and public.portal_has_rate_card_project(rate_card_id))
  with check (public.portal_can('rates') and public.portal_has_rate_card_project(rate_card_id));
create policy "portal_delete_rates"
  on public.rates for delete to authenticated
  using (public.portal_can('rates') and public.portal_has_rate_card_project(rate_card_id));
