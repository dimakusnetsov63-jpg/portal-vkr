-- Фаза C1: политики проектных таблиц переезжают на VIEW/EDIT (ADR-005).
--
-- 22 политики на 7 таблицах: SELECT начинает спрашивать
-- portal_can_view_section(<раздел>), а INSERT/UPDATE/DELETE —
-- portal_can_edit_section(<раздел>). До этой миграции обе операции
-- проверяли один и тот же portal_can(<раздел>), который с 20260811100200
-- является синонимом VIEW.
--
-- Наблюдаемое поведение не меняется ни для одной роли. В baseline-матрице
-- (20260811100000) у всех затронутых здесь разделов can_edit = can_view:
--   candidates / addresses / rates — обе колонки true у всех четырёх ролей;
--   demand — true у head/coordinator/manager, раздела нет у recruiter.
-- Разделение начнёт что-то менять только тогда, когда администратор снимет
-- галочку «Редактирование» в «Настройки → Доступы» (фаза E).
--
-- Проектная проверка H-6 переносится дословно: portal_has_project(project),
-- а для public.rates — portal_has_rate_card_project(rate_card_id) (своей
-- колонки project у неё нет). Принцип, набор таблиц и bypass роли head не
-- трогаются — меняется только секционная половина условия.
--
-- Откат: определения политик до этой миграции лежат в
-- 20260803140000_project_scoped_rls_policies.sql — файл достаточно
-- выполнить повторно, он написан как drop+create.

-- === candidates ===
drop policy "portal_select_candidates" on public.candidates;
drop policy "portal_insert_candidates" on public.candidates;
drop policy "portal_update_candidates" on public.candidates;

create policy "portal_select_candidates"
  on public.candidates for select to authenticated
  using (public.portal_can_view_section('candidates') and public.portal_has_project(project));
create policy "portal_insert_candidates"
  on public.candidates for insert to authenticated
  with check (public.portal_can_edit_section('candidates') and public.portal_has_project(project));
create policy "portal_update_candidates"
  on public.candidates for update to authenticated
  using (public.portal_can_edit_section('candidates') and public.portal_has_project(project))
  with check (public.portal_can_edit_section('candidates') and public.portal_has_project(project));

-- === staffing_demand ===
-- Удаление остаётся штатным действием в матрице «Потребность» (у таблицы
-- нет archived_at, очистка ячейки — это физический DELETE), поэтому оно
-- гейтится обычным EDIT раздела, а не отдельным административным правом.
drop policy "portal_select_staffing_demand" on public.staffing_demand;
drop policy "portal_insert_staffing_demand" on public.staffing_demand;
drop policy "portal_update_staffing_demand" on public.staffing_demand;
drop policy "portal_delete_staffing_demand" on public.staffing_demand;

create policy "portal_select_staffing_demand"
  on public.staffing_demand for select to authenticated
  using (public.portal_can_view_section('demand') and public.portal_has_project(project));
create policy "portal_insert_staffing_demand"
  on public.staffing_demand for insert to authenticated
  with check (public.portal_can_edit_section('demand') and public.portal_has_project(project));
create policy "portal_update_staffing_demand"
  on public.staffing_demand for update to authenticated
  using (public.portal_can_edit_section('demand') and public.portal_has_project(project))
  with check (public.portal_can_edit_section('demand') and public.portal_has_project(project));
create policy "portal_delete_staffing_demand"
  on public.staffing_demand for delete to authenticated
  using (public.portal_can_edit_section('demand') and public.portal_has_project(project));

-- === staffing_demand_rows ===
drop policy "portal_select_staffing_demand_rows" on public.staffing_demand_rows;
drop policy "portal_insert_staffing_demand_rows" on public.staffing_demand_rows;
drop policy "portal_update_staffing_demand_rows" on public.staffing_demand_rows;

create policy "portal_select_staffing_demand_rows"
  on public.staffing_demand_rows for select to authenticated
  using (public.portal_can_view_section('demand') and public.portal_has_project(project));
create policy "portal_insert_staffing_demand_rows"
  on public.staffing_demand_rows for insert to authenticated
  with check (public.portal_can_edit_section('demand') and public.portal_has_project(project));
create policy "portal_update_staffing_demand_rows"
  on public.staffing_demand_rows for update to authenticated
  using (public.portal_can_edit_section('demand') and public.portal_has_project(project))
  with check (public.portal_can_edit_section('demand') and public.portal_has_project(project));

-- === staffing_demand_history (только чтение — пишет SECURITY DEFINER-триггер) ===
drop policy "portal_select_staffing_demand_history" on public.staffing_demand_history;

create policy "portal_select_staffing_demand_history"
  on public.staffing_demand_history for select to authenticated
  using (public.portal_can_view_section('demand') and public.portal_has_project(project));

-- === addresses ===
drop policy "portal_select_addresses" on public.addresses;
drop policy "portal_insert_addresses" on public.addresses;
drop policy "portal_update_addresses" on public.addresses;

create policy "portal_select_addresses"
  on public.addresses for select to authenticated
  using (public.portal_can_view_section('addresses') and public.portal_has_project(project));
create policy "portal_insert_addresses"
  on public.addresses for insert to authenticated
  with check (public.portal_can_edit_section('addresses') and public.portal_has_project(project));
create policy "portal_update_addresses"
  on public.addresses for update to authenticated
  using (public.portal_can_edit_section('addresses') and public.portal_has_project(project))
  with check (public.portal_can_edit_section('addresses') and public.portal_has_project(project));

-- === rate_cards ===
drop policy "portal_select_rate_cards" on public.rate_cards;
drop policy "portal_insert_rate_cards" on public.rate_cards;
drop policy "portal_update_rate_cards" on public.rate_cards;
drop policy "portal_delete_rate_cards" on public.rate_cards;

create policy "portal_select_rate_cards"
  on public.rate_cards for select to authenticated
  using (public.portal_can_view_section('rates') and public.portal_has_project(project));
create policy "portal_insert_rate_cards"
  on public.rate_cards for insert to authenticated
  with check (public.portal_can_edit_section('rates') and public.portal_has_project(project));
create policy "portal_update_rate_cards"
  on public.rate_cards for update to authenticated
  using (public.portal_can_edit_section('rates') and public.portal_has_project(project))
  with check (public.portal_can_edit_section('rates') and public.portal_has_project(project));
create policy "portal_delete_rate_cards"
  on public.rate_cards for delete to authenticated
  using (public.portal_can_edit_section('rates') and public.portal_has_project(project));

-- === rates ===
-- Проект берётся через связанную rate_cards — своей колонки project нет.
drop policy "portal_select_rates" on public.rates;
drop policy "portal_insert_rates" on public.rates;
drop policy "portal_update_rates" on public.rates;
drop policy "portal_delete_rates" on public.rates;

create policy "portal_select_rates"
  on public.rates for select to authenticated
  using (public.portal_can_view_section('rates') and public.portal_has_rate_card_project(rate_card_id));
create policy "portal_insert_rates"
  on public.rates for insert to authenticated
  with check (public.portal_can_edit_section('rates') and public.portal_has_rate_card_project(rate_card_id));
create policy "portal_update_rates"
  on public.rates for update to authenticated
  using (public.portal_can_edit_section('rates') and public.portal_has_rate_card_project(rate_card_id))
  with check (public.portal_can_edit_section('rates') and public.portal_has_rate_card_project(rate_card_id));
create policy "portal_delete_rates"
  on public.rates for delete to authenticated
  using (public.portal_can_edit_section('rates') and public.portal_has_rate_card_project(rate_card_id));
