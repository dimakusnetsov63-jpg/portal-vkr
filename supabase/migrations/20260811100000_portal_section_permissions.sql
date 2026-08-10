-- Единая матрица прав «роль → раздел → VISIBLE / VIEW / EDIT» (фаза A).
--
-- Миграция аддитивная: таблица создаётся и засевается, но ни одна политика
-- RLS и ни один запрос приложения её пока не читают. После применения
-- наблюдаемое поведение системы не меняется ни для одной роли —
-- переключение политик на новые функции идёт отдельными миграциями
-- (фаза C), после сверки baseline (фаза B).
--
-- Зачем таблица вместо двух захардкоженных матриц (src/lib/auth/roles.ts +
-- public.portal_role_sections): сегодня они синхронизируются вручную, и
-- рассинхронизацию не ловят ни типы, ни тесты — об этом прямо написано в
-- комментарии самого roles.ts. Плюс права должны стать редактируемыми из
-- «Настройки → Доступы», а не только правкой кода и накаткой миграции.
--
-- Три уровня вместо одного булева «раздел доступен»:
--   visible  — показывать пункт в меню. Это UX, а НЕ механизм безопасности:
--              прямой заход по URL всё равно обязан упереться в can_view;
--   can_view — открывать раздел и читать данные (SELECT в политиках);
--   can_edit — изменять данные (INSERT/UPDATE/DELETE в политиках).

-- Канонический список разделов и их порядок ------------------------------
-- Один источник и для проверки корректности значения `section` (опечатка в
-- миграции иначе молча создала бы право, которого никто никогда не получит),
-- и для порядка элементов в portal_role_sections(). Порядок совпадает с
-- SECTION_ORDER в src/lib/auth/roles.ts — это порядок пунктов меню.
--
-- `users` — не пункт меню, а право управлять учётными записями (панель
-- «Команда и роли» внутри «Настроек»). В массиве он последний, ровно как в
-- ROLE_PERMISSIONS.head и в прежней реализации portal_role_sections().
--
-- immutable — обязательное условие для использования в CHECK-ограничении.
create function public.portal_section_order()
returns text[]
language sql
immutable
as $$
  select array[
    'overview', 'demand', 'addresses', 'candidates', 'vacancies', 'rates',
    'marketing', 'analytics', 'notifications', 'settings', 'users'
  ];
$$;

comment on function public.portal_section_order() is
  'Канонический список прав портала в порядке меню (10 разделов + users). Задаёт и допустимые значения portal_section_permissions.section, и порядок элементов в portal_role_sections(). Новый раздел портала = правка этой функции + строки в portal_section_permissions.';

-- Матрица ----------------------------------------------------------------
create table public.portal_section_permissions (
  id uuid primary key default gen_random_uuid(),
  role public.portal_user_role not null,
  section text not null,
  -- NULL = правило роли для всех её проектов. Ненулевое значение —
  -- задел под будущие project-specific overrides (разные права у одной
  -- роли в разных проектах). В первой версии создаются только NULL-строки,
  -- и все функции ниже читают только их: колонка существует, чтобы
  -- добавление overrides не потребовало переделки схемы и повторной
  -- миграции всей матрицы.
  project text,
  visible boolean not null default false,
  can_view boolean not null default false,
  can_edit boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint portal_section_permissions_section_known
    check (section = any (public.portal_section_order())),

  -- Инвариант из ТЗ: can_edit => can_view => visible. Записан через
  -- «не A или B», потому что оба поля not null — трёхзначной логики здесь
  -- не возникает. Ограничение живёт в базе, а не только в интерфейсе:
  -- невалидное состояние не должно создаваться ни ручным UPDATE из SQL
  -- Editor, ни будущей RPC, ни ошибкой в UI.
  constraint portal_section_permissions_view_implies_visible
    check (not can_view or visible),
  constraint portal_section_permissions_edit_implies_view
    check (not can_edit or can_view)
);

-- Уникальность правила. Два частичных индекса, а не одно
-- unique (role, section, project): в Postgres NULL не конфликтует с NULL,
-- поэтому обычное ограничение пустило бы два «правила для всех проектов»
-- на одну пару (role, section) — ровно тот случай, который здесь и нужно
-- запретить. `nulls not distinct` решило бы это одной строкой, но требует
-- PG15+; частичные индексы работают везде.
create unique index portal_section_permissions_role_section_key
  on public.portal_section_permissions (role, section)
  where project is null;

create unique index portal_section_permissions_role_section_project_key
  on public.portal_section_permissions (role, section, project)
  where project is not null;

comment on table public.portal_section_permissions is
  'Матрица прав «роль → раздел → visible/can_view/can_edit». Источник истины для portal_role_sections()/portal_can_view_section()/portal_can_edit_section(). Редактируется только через SECURITY DEFINER-функции: таблица закрыта RLS без политик, как portal_users.';
comment on column public.portal_section_permissions.project is
  'NULL — правило действует на все проекты роли (единственный вариант в первой версии). Ненулевое значение зарезервировано под project-specific overrides; функции проверки прав такие строки пока не читают.';
comment on column public.portal_section_permissions.visible is
  'Показывать ли раздел в меню. Только UX: скрытый раздел обязан быть недоступен и по прямому URL — за это отвечает can_view, а не это поле.';

create trigger trg_portal_section_permissions_set_updated_at
  before update on public.portal_section_permissions
  for each row
  execute function public.set_candidates_updated_at();

-- Доступ к самой таблице -------------------------------------------------
-- Та же модель, что у portal_users/portal_sessions/portal_audit_log: RLS
-- включён, политик нет вообще, гранты отозваны. Напрямую через PostgREST
-- матрицу не прочитать и не изменить — только через SECURITY DEFINER
-- функции. Чтение матрицы интерфейсом и её редактирование администратором
-- появятся как отдельные RPC в фазе D; до тех пор пользователь не может
-- менять свои права ни при каком стечении обстоятельств.
alter table public.portal_section_permissions enable row level security;

revoke all on public.portal_section_permissions from anon, authenticated;

-- Baseline seed ----------------------------------------------------------
-- Воспроизводит действующую матрицу один в один. Источники:
--   * ROLE_PERMISSIONS в src/lib/auth/roles.ts;
--   * public.portal_role_sections() в редакции миграции
--     20260731100300_update_portal_role_sections_rates.sql (последняя).
-- Обе совпадают между собой; сверка автоматизирована в
-- src/lib/auth/sectionPermissionsSeed.test.ts.
--
-- Правило переноса: раздел есть у роли → visible = can_view = can_edit =
-- true; раздела нет → все три false (строка всё равно заводится, чтобы
-- у каждой пары «роль × раздел» была ячейка, которую можно включить из
-- интерфейса, и чтобы сверка была полной, а не по присутствующим строкам).
--
-- Единственное исключение — `vacancies` у manager и recruiter: сегодня
-- запись в vacancy_* требует `portal_can('vacancies') and
-- portal_can('settings')` (миграция 20260805100500), то есть читают
-- вакансии все четыре роли, а редактируют только head и coordinator. В
-- новой модели это выражается напрямую: can_view = true, can_edit = false.
-- Никаких других прав здесь не выдаётся и не отбирается.
--
-- ВАЖНО для фазы C — таблицы, у которых запись сегодня гейтится вторым
-- разделом, а не своим собственным. Их политики нельзя переводить на
-- can_edit «своего» раздела, иначе роли получат права, которых у них
-- сейчас нет:
--   candidate_list_options  запись = portal_can('settings')
--                           → portal_can_edit_section('settings')
--   vacancy_*               запись = vacancies and settings
--                           → portal_can_edit_section('vacancies')
--                             (в seed уже false у manager/recruiter)
--   address_demand_history  запись = addresses and settings
--                           → ... and portal_can_edit_section('settings')
--   project_import_configs  запись = addresses and settings
--   staffing_demand_imports запись = addresses and settings
--                           → ... and portal_can_edit_section('settings')
-- Раздел «Адреса» редактируют все четыре роли, а импорт/историю — только
-- head и coordinator, поэтому одного can_edit('addresses') для них
-- недостаточно: связка «раздел + settings» сохраняется.
insert into public.portal_section_permissions (role, section, project, visible, can_view, can_edit) values
  -- head — все разделы и управление учётными записями.
  ('head', 'overview',      null, true,  true,  true),
  ('head', 'demand',        null, true,  true,  true),
  ('head', 'addresses',     null, true,  true,  true),
  ('head', 'candidates',    null, true,  true,  true),
  ('head', 'vacancies',     null, true,  true,  true),
  ('head', 'rates',         null, true,  true,  true),
  ('head', 'marketing',     null, true,  true,  true),
  ('head', 'analytics',     null, true,  true,  true),
  ('head', 'notifications', null, true,  true,  true),
  ('head', 'settings',      null, true,  true,  true),
  ('head', 'users',         null, true,  true,  true),

  -- coordinator — всё, кроме управления учётными записями.
  ('coordinator', 'overview',      null, true,  true,  true),
  ('coordinator', 'demand',        null, true,  true,  true),
  ('coordinator', 'addresses',     null, true,  true,  true),
  ('coordinator', 'candidates',    null, true,  true,  true),
  ('coordinator', 'vacancies',     null, true,  true,  true),
  ('coordinator', 'rates',         null, true,  true,  true),
  ('coordinator', 'marketing',     null, true,  true,  true),
  ('coordinator', 'analytics',     null, true,  true,  true),
  ('coordinator', 'notifications', null, true,  true,  true),
  ('coordinator', 'settings',      null, true,  true,  true),
  ('coordinator', 'users',         null, false, false, false),

  -- manager — без маркетинга, аналитики, настроек и учётных записей.
  -- vacancies: читает, но не редактирует (см. исключение выше).
  ('manager', 'overview',      null, true,  true,  true),
  ('manager', 'demand',        null, true,  true,  true),
  ('manager', 'addresses',     null, true,  true,  true),
  ('manager', 'candidates',    null, true,  true,  true),
  ('manager', 'vacancies',     null, true,  true,  false),
  ('manager', 'rates',         null, true,  true,  true),
  ('manager', 'marketing',     null, false, false, false),
  ('manager', 'analytics',     null, false, false, false),
  ('manager', 'notifications', null, true,  true,  true),
  ('manager', 'settings',      null, false, false, false),
  ('manager', 'users',         null, false, false, false),

  -- recruiter — «Адреса», «Кандидаты», «Вакансии», «Ставки», «Уведомления».
  -- vacancies: читает, но не редактирует (см. исключение выше).
  ('recruiter', 'overview',      null, false, false, false),
  ('recruiter', 'demand',        null, false, false, false),
  ('recruiter', 'addresses',     null, true,  true,  true),
  ('recruiter', 'candidates',    null, true,  true,  true),
  ('recruiter', 'vacancies',     null, true,  true,  false),
  ('recruiter', 'rates',         null, true,  true,  true),
  ('recruiter', 'marketing',     null, false, false, false),
  ('recruiter', 'analytics',     null, false, false, false),
  ('recruiter', 'notifications', null, true,  true,  true),
  ('recruiter', 'settings',      null, false, false, false),
  ('recruiter', 'users',         null, false, false, false);
