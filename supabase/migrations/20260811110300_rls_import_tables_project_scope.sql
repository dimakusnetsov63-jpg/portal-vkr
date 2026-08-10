-- Фаза C4: таблицы импорта — VIEW/EDIT **и** закрытие пробела H-6.
--
-- ЕДИНСТВЕННАЯ миграция фазы C, которая меняет наблюдаемое поведение.
-- Вынесена отдельным файлом и последней именно поэтому: если после выката
-- что-то сломается в разделе «Адреса» или в истории импортов, откатывать
-- нужно ровно её, не трогая C1–C3.
--
-- Что меняется по существу:
--
-- 1. project_import_configs и staffing_demand_imports получают
--    portal_has_project(project). Обе таблицы имеют колонку project с
--    момента создания (20260805110000), но заведены были до H-6 и проект
--    в политиках не проверяли вовсе — пробел зафиксирован в
--    docs/database/policies.md и подтверждён аудитом фазы C.
--
--    Практическое следствие: координатор, у которого в portal_users.projects
--    перечислена часть проектов, перестаёт видеть конфигурацию парсера и
--    историю импортов чужих проектов. Роль head не затронута (bypass в
--    portal_has_project), пользователь с all_projects = true — тоже.
--    Это сужение прав, а не расширение.
--
-- 2. portal_write_project_import_configs (`for all`) разбивается на
--    отдельные INSERT/UPDATE/DELETE. `for all` покрывала и SELECT, из-за
--    чего у таблицы фактически было две пересекающиеся политики чтения;
--    отдельные политики на операцию делают набор читаемым и симметричным
--    staffing_demand_imports. DELETE при разбиении сохраняется явно —
--    именно его легче всего потерять, `for all` выдавала его молча.
--
-- Что НЕ меняется: административный гейт `settings` остаётся на обеих
-- таблицах. Раздел «Адреса» редактируют все четыре роли, а импорт и его
-- историю — только head и coordinator, поэтому одного edit('addresses')
-- здесь недостаточно, как и в фазе C2.
--
-- Чтение гейтится view('settings'), а не edit('settings'): чтение остаётся
-- чтением. Сегодня это одно и то же (у обеих ролей с разделом настроек
-- view = edit = true), но после фазы E администратор сможет выставить
-- settings view = true, edit = false — и edit в SELECT-политике отобрал бы
-- чтение без всякой причины.
--
-- Откат: прежние определения — в
-- 20260805110000_add_demand_import_support.sql (раздел Row Level Security).
-- Откатывать имеет смысл только этот файл целиком: C1–C3 от него не
-- зависят.

-- === project_import_configs ===
drop policy "portal_select_project_import_configs" on public.project_import_configs;
drop policy "portal_write_project_import_configs" on public.project_import_configs;

create policy "portal_select_project_import_configs"
  on public.project_import_configs for select to authenticated
  using (
    public.portal_can_view_section('addresses')
    and public.portal_can_view_section('settings')
    and public.portal_has_project(project)
  );
create policy "portal_insert_project_import_configs"
  on public.project_import_configs for insert to authenticated
  with check (
    public.portal_can_edit_section('addresses')
    and public.portal_can_edit_section('settings')
    and public.portal_has_project(project)
  );
create policy "portal_update_project_import_configs"
  on public.project_import_configs for update to authenticated
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
create policy "portal_delete_project_import_configs"
  on public.project_import_configs for delete to authenticated
  using (
    public.portal_can_edit_section('addresses')
    and public.portal_can_edit_section('settings')
    and public.portal_has_project(project)
  );

-- === staffing_demand_imports ===
-- DELETE-политики у таблицы не было и не появляется: журнал импортов не
-- удаляется (отмена импорта помечает строку статусом 'reverted', см.
-- src/lib/imports/revertImport.ts). Добавлять её «заодно» здесь было бы
-- расширением прав, а не переводом.
drop policy "portal_select_staffing_demand_imports" on public.staffing_demand_imports;
drop policy "portal_insert_staffing_demand_imports" on public.staffing_demand_imports;
drop policy "portal_update_staffing_demand_imports" on public.staffing_demand_imports;

create policy "portal_select_staffing_demand_imports"
  on public.staffing_demand_imports for select to authenticated
  using (
    public.portal_can_view_section('addresses')
    and public.portal_can_view_section('settings')
    and public.portal_has_project(project)
  );
create policy "portal_insert_staffing_demand_imports"
  on public.staffing_demand_imports for insert to authenticated
  with check (
    public.portal_can_edit_section('addresses')
    and public.portal_can_edit_section('settings')
    and public.portal_has_project(project)
  );
create policy "portal_update_staffing_demand_imports"
  on public.staffing_demand_imports for update to authenticated
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
