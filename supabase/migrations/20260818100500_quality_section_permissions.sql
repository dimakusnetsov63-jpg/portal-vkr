-- TASK-013: раздел «Контроль качества» в матрице прав.
--
-- С фазы D ADR-005 портал берёт права из portal_section_permissions, а
-- portal_role_sections() читает эту же таблицу. Поэтому новый раздел — это
-- ровно две вещи: пополнить канонический список разделов и завести по
-- строке на каждую роль. Переписывать portal_role_sections() больше не
-- нужно (до 20260811100200 пришлось бы).
--
-- Зеркальная правка в коде — SECTION_ORDER и ROLE_PERMISSIONS в
-- src/lib/auth/roles.ts. Расхождение между ними ловит
-- sectionPermissionsSeed.test.ts, разбирающий seed прямо из текста
-- миграции: тест сверяет состав, порядок и инварианты.

-- Канонический список: 'quality' встаёт после 'rates' — это же место
-- пункта в меню и, следовательно, в SECTION_ORDER.
--
-- Функция участвует в CHECK-ограничении portal_section_permissions_section_known.
-- `create or replace` сохраняет OID, поэтому ограничение продолжает
-- работать и начинает пропускать новое значение. Существующие строки при
-- этом не перепроверяются — здесь это безразлично: список только
-- расширяется, ни одно прежнее значение из него не исчезает.
create or replace function public.portal_section_order()
returns text[]
language sql
immutable
as $$
  select array[
    'overview', 'demand', 'addresses', 'candidates', 'vacancies', 'rates',
    'quality', 'marketing', 'analytics', 'notifications', 'settings', 'users'
  ];
$$;

comment on function public.portal_section_order() is
  'Канонический список прав портала в порядке меню (11 разделов + users). Задаёт и допустимые значения portal_section_permissions.section, и порядок элементов в portal_role_sections(). Новый раздел портала = правка этой функции + строки в portal_section_permissions.';

-- Baseline нового раздела.
--
-- head, coordinator — видят, читают и заполняют проверки: это их работа.
-- manager           — видит и читает, но не заполняет: руководителю группы
--                     нужны результаты, а проверку проводит контроль
--                     качества. Та же связка «читает, но не редактирует»,
--                     что у vacancies с самого начала фазы A.
-- recruiter         — раздела нет вовсе. Доступ рекрутёра к СВОИМ
--                     проверкам потребовал бы политики нового типа («своя
--                     строка»), которой в портале сейчас нет: изоляция
--                     работает по проектам, не по авторству. Это отдельная
--                     задача, см. «Не входит в задачу» в TASK-013.
--
-- Значения — только стартовые: с фазы E любая ячейка переключается в
-- «Настройки → Доступы» без миграции и деплоя.
insert into public.portal_section_permissions (role, section, project, visible, can_view, can_edit) values
  ('head',        'quality', null, true,  true,  true),
  ('coordinator', 'quality', null, true,  true,  true),
  ('manager',     'quality', null, true,  true,  false),
  ('recruiter',   'quality', null, false, false, false);
