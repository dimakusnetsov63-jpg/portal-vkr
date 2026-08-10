-- Фаза C2: таблицы с дополнительным административным гейтом (ADR-005).
--
-- 7 политик на 2 таблицах. Здесь важно не то, что переводится, а то, что
-- НЕ переводится: у обеих таблиц запись гейтится **вторым** разделом
-- (settings), а не тем, к которому таблица относится.
--
--   candidate_list_options   чтение — candidates, запись — settings
--   address_demand_history   чтение — demand,     запись — addresses + settings
--
-- Соблазн перевести запись в portal_can_edit_section('candidates') /
-- ('addresses') нужно осознанно отвергнуть: у обоих этих разделов
-- can_edit = true у **всех четырёх** ролей, поэтому такой перевод выдал бы
-- manager и recruiter право править общие справочники и историю
-- потребности, которого у них сегодня нет. Административная половина
-- условия сохраняется как portal_can_edit_section('settings').
--
-- Проверка эквивалентности по ролям (сегодня → после):
--   candidate_list_options, запись: view(settings) → edit(settings)
--     head T→T, coordinator T→T, manager F→F, recruiter F→F
--   address_demand_history, запись:
--     view(addresses) ∧ view(settings) → edit(addresses) ∧ edit(settings)
--     head T∧T→T∧T, coordinator T∧T→T∧T,
--     manager T∧F→T∧F (=false), recruiter T∧F→T∧F (=false)
-- Наблюдаемое поведение не меняется.
--
-- Откат: прежние определения — в 20260728120000_portal_auth.sql
-- (candidate_list_options) и 20260807100300_address_demand_history.sql.

-- === candidate_list_options ===
-- Справочники подсказок читают все, у кого есть «Кандидаты»; правит их
-- только тот, кому доступно редактирование «Настроек». DELETE-политики у
-- таблицы нет с 20260722214949 (soft-delete через is_active) — здесь она
-- намеренно не появляется.
drop policy "portal_select_candidate_list_options" on public.candidate_list_options;
drop policy "portal_insert_candidate_list_options" on public.candidate_list_options;
drop policy "portal_update_candidate_list_options" on public.candidate_list_options;

create policy "portal_select_candidate_list_options"
  on public.candidate_list_options for select to authenticated
  using (public.portal_can_view_section('candidates'));
create policy "portal_insert_candidate_list_options"
  on public.candidate_list_options for insert to authenticated
  with check (public.portal_can_edit_section('settings'));
create policy "portal_update_candidate_list_options"
  on public.candidate_list_options for update to authenticated
  using (public.portal_can_edit_section('settings'))
  with check (public.portal_can_edit_section('settings'));

-- === address_demand_history ===
-- Асимметрия аудитории сохраняется дословно: читает аудитория
-- «Потребности» (иначе менеджер не увидел бы вычисленные ячейки матрицы
-- через staffing_demand_effective, хотя раздел «Адреса» ему не доступен),
-- пишет — только пайплайн импорта. Проектная проверка H-6 на обеих
-- сторонах, как и было.
drop policy "portal_select_address_demand_history" on public.address_demand_history;
drop policy "portal_insert_address_demand_history" on public.address_demand_history;
drop policy "portal_update_address_demand_history" on public.address_demand_history;
drop policy "portal_delete_address_demand_history" on public.address_demand_history;

create policy "portal_select_address_demand_history"
  on public.address_demand_history for select to authenticated
  using (public.portal_can_view_section('demand') and public.portal_has_project(project));
create policy "portal_insert_address_demand_history"
  on public.address_demand_history for insert to authenticated
  with check (
    public.portal_can_edit_section('addresses')
    and public.portal_can_edit_section('settings')
    and public.portal_has_project(project)
  );
create policy "portal_update_address_demand_history"
  on public.address_demand_history for update to authenticated
  using (
    public.portal_can_edit_section('addresses')
    and public.portal_can_edit_section('settings')
    and public.portal_has_project(project)
  )
  with check (
    public.portal_can_edit_section('addresses')
    and public.portal_can_edit_section('settings')
    and public.portal_has_project(project)
  );
create policy "portal_delete_address_demand_history"
  on public.address_demand_history for delete to authenticated
  using (
    public.portal_can_edit_section('addresses')
    and public.portal_can_edit_section('settings')
    and public.portal_has_project(project)
  );
