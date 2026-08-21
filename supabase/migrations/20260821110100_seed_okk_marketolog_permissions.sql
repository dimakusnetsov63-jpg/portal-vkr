-- Строки матрицы прав для новых ролей `okk` и `marketolog`
-- (enum пополнен предыдущей миграцией, 20260821110000).
--
-- Все три флага выключены у обеих ролей по всем 12 правам. Это не
-- «забыли выдать»: права новых ролей руководитель настраивает сам в
-- «Настройки → Доступы», и стартовое состояние выбрано так, чтобы ни одна
-- новая учётная запись не получила доступа к данным раньше, чем этот выбор
-- будет сделан. Обратный порядок («выдать, потом отобрать») означал бы
-- окно, в котором роль видит больше, чем задумано.
--
-- Строки при этом обязаны существовать: portal_admin_set_section_permission
-- только обновляет готовую строку и отвечает P0002 «Правило для роли % и
-- раздела % не найдено», если её нет. Без seed панель «Доступы» показала бы
-- для новых ролей пустые ячейки без переключателей, и включить им хоть
-- что-то из интерфейса было бы нельзя.
--
-- Следствие, о котором нужно помнить до первой настройки: пользователь с
-- ролью ОКК или Маркетолог войдёт в портал, но не увидит ни одного раздела
-- (`firstViewableSection` вернёт undefined). Это законное состояние —
-- ровно то же самое получится, если отобрать все права у любой другой
-- роли, — но заводить такие учётные записи стоит после того, как права
-- роли выставлены.
--
-- Зеркальная правка в коде — PORTAL_ROLES, ROLE_LABELS и ROLE_PERMISSIONS в
-- src/lib/auth/roles.ts (у обеих ролей — пустой список). Расхождение ловит
-- src/lib/auth/sectionPermissionsSeed.test.ts, разбирающий seed прямо из
-- текста миграций.

insert into public.portal_section_permissions (role, section, project, visible, can_view, can_edit) values
  -- ОКК — отдел контроля качества.
  ('okk', 'overview',      null, false, false, false),
  ('okk', 'demand',        null, false, false, false),
  ('okk', 'addresses',     null, false, false, false),
  ('okk', 'candidates',    null, false, false, false),
  ('okk', 'vacancies',     null, false, false, false),
  ('okk', 'rates',         null, false, false, false),
  ('okk', 'quality',       null, false, false, false),
  ('okk', 'marketing',     null, false, false, false),
  ('okk', 'analytics',     null, false, false, false),
  ('okk', 'notifications', null, false, false, false),
  ('okk', 'settings',      null, false, false, false),
  ('okk', 'users',         null, false, false, false),

  -- Маркетолог.
  ('marketolog', 'overview',      null, false, false, false),
  ('marketolog', 'demand',        null, false, false, false),
  ('marketolog', 'addresses',     null, false, false, false),
  ('marketolog', 'candidates',    null, false, false, false),
  ('marketolog', 'vacancies',     null, false, false, false),
  ('marketolog', 'rates',         null, false, false, false),
  ('marketolog', 'quality',       null, false, false, false),
  ('marketolog', 'marketing',     null, false, false, false),
  ('marketolog', 'analytics',     null, false, false, false),
  ('marketolog', 'notifications', null, false, false, false),
  ('marketolog', 'settings',      null, false, false, false),
  ('marketolog', 'users',         null, false, false, false);
