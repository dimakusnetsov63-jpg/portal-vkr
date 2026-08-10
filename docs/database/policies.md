# Политики доступа (RLS)

Модель доступа к данным в Postgres/Supabase. Схема таблиц — [`schema.md`](schema.md),
решение об этой модели и его цена — [`ADR-004-portal-auth.md`](../architecture/decisions/ADR-004-portal-auth.md).
Правила ролей на языке бизнеса — [`../requirements/access-control.md`](../requirements/access-control.md).

## Действующая модель

RLS включён на **всех семнадцати** таблицах схемы `public` (одиннадцать +
пять таблиц TASK-010 «Описание вакансии» + `address_demand_history`,
20260807100300). Политики созданы
только для роли `authenticated`; для `anon` политик нет ни на одной таблице —
неавторизованный доступ запрещён по умолчанию.

С июля 2026 политики **не безусловные**. Каждая ссылается на
`public.portal_can('<раздел>')` — есть ли у текущего пользователя доступ к
разделу, к которому относится таблица.

С H-6 (3 августа 2026, миграция `20260803140000_project_scoped_rls_policies.sql`)
на шести таблицах с колонкой `project` (`candidates`, `staffing_demand`,
`staffing_demand_rows`, `staffing_demand_history`, `addresses`, `rate_cards`)
и на `rates` (через FK на `rate_cards`) к проверке раздела добавлена
проверка проекта. `address_demand_history` (20260807100300) добавлена уже
с этой проверкой сразу, а не отдельной миграцией задним числом — её
`select`-политика намеренно скопирована с `staffing_demand`
(`portal_can('demand')`), не с `addresses`, чтобы вычисленные ячейки
«Потребности» видел тот же менеджер/координатор, что видит саму матрицу:

```sql
create policy "portal_select_staffing_demand"
  on public.staffing_demand for select to authenticated
  using (public.portal_can('demand') and public.portal_has_project(project));

-- rates — своей колонки project нет, только rate_card_id
create policy "portal_select_rates"
  on public.rates for select to authenticated
  using (public.portal_can('rates') and public.portal_has_rate_card_project(rate_card_id));
```

`portal_can` и `portal_has_project`/`portal_has_rate_card_project` читают
роль, `is_active` и `projects` **из `portal_users`**, а не из JWT.
Практические следствия:

- смена роли или списка проектов действует со следующего запроса, перевыпуск
  токена не нужен;
- отключение сотрудника закрывает данные сразу, не дожидаясь истечения его
  токена доступа (15 минут).

**Роль `head` — bypass проектной проверки.** `portal_has_project()` для неё
всегда возвращает `true` независимо от содержимого её собственного
`projects` — архитектурное решение H-6, не default-поведение самой функции.
Подробности и обоснование — `docs/ROLLOUT-project-access.md`.

## Фаза A новой модели доступа: политики НЕ изменены

11 августа 2026 добавлены четыре миграции (`20260811100000`…`20260811100300`,
**к боевой базе не применялись**), переносящие матрицу прав из кода в таблицу
`portal_section_permissions` и вводящие разделение `visible`/`can_view`/
`can_edit` — см. [`ADR-005`](../architecture/decisions/ADR-005-access-control-v2.md).

**Ни одна политика RLS в фазе A не переписана.** Список политик, их выражения
и таблица «состав политик» ниже действительны как были. Изменилась только
реализация двух функций, которые эти политики вызывают, — при неизменном
результате:

- `portal_can(section)` стал синонимом `portal_can_view_section(section)`;
- `portal_role_sections(role)` читает `portal_section_permissions` вместо
  захардкоженного `case`.

Baseline матрицы воспроизводит прежние права один в один (сверка —
`src/lib/auth/sectionPermissionsSeed.test.ts`, 23 теста), поэтому наблюдаемое
поведение для всех четырёх ролей не меняется. Перевод политик на явные
`portal_can_view_section`/`portal_can_edit_section` — отдельная задача
(фаза C).

**Ловушка фазы C, зафиксированная заранее.** У пяти таблиц запись гейтится
*вторым* разделом, а не своим собственным. Переводить их на `can_edit`
«своего» раздела нельзя — роли получат права, которых у них сейчас нет:

| Таблица | Запись сегодня | Во что переводить |
|---|---|---|
| `candidate_list_options` | `portal_can('settings')` | `portal_can_edit_section('settings')` |
| `vacancy_*` (5 таблиц) | `vacancies` + `settings` | `portal_can_edit_section('vacancies')` — в baseline уже `false` у manager/recruiter |
| `address_demand_history` | `addresses` + `settings` | `... and portal_can_edit_section('settings')` |
| `project_import_configs` | `addresses` + `settings` | `... and portal_can_edit_section('settings')` |
| `staffing_demand_imports` | `addresses` + `settings` | `... and portal_can_edit_section('settings')` |

Причина: раздел «Адреса» редактируют все четыре роли, а импорт и историю —
только head/coordinator. Гранулярность «роль × раздел» это одним булевым
полем не выражает, поэтому связка «раздел + `settings`» сохраняется.

## Состав политик по таблицам

| Таблица | Раздел | select | insert | update | delete |
|---|---|:--:|:--:|:--:|:--:|
| `candidates` | `candidates` | ✅ | ✅ | ✅ | ❌ |
| `candidate_list_options` | `candidates` (чтение) / `settings` (запись) | ✅ | ✅ | ✅ | ❌ |
| `staffing_demand` | `demand` | ✅ | ✅ | ✅ | **✅** |
| `staffing_demand_rows` | `demand` | ✅ | ✅ | ✅ | ❌ |
| `staffing_demand_history` | `demand` | ✅ | ❌ | ❌ | ❌ |
| `addresses` | `addresses` | ✅ | ✅ | ✅ | ❌ |
| `address_demand_history` | `demand` (чтение) / `addresses`+`settings` (запись) | ✅ | ✅ | ✅ | **✅** |
| `rate_cards` | `rates` | ✅ | ✅ | ✅ | **✅** |
| `rates` | `rates` | ✅ | ✅ | ✅ | **✅** |
| `vacancy_projects` | `vacancies` (чтение) / `vacancies` + `settings` (запись) | ✅ | ✅ | ✅ | ❌ |
| `vacancy_sections` | `vacancies` (чтение) / `vacancies` + `settings` (запись) | ✅ | ✅ | ✅ | **✅** |
| `vacancy_fields` | `vacancies` (чтение) / `vacancies` + `settings` (запись) | ✅ | ✅ | ✅ | **✅** |
| `vacancy_attachments` | `vacancies` (чтение) / `vacancies` + `settings` (запись) | ✅ | ✅ | ✅ | **✅** |
| `vacancy_history` | `vacancies` | ✅ | ❌ | ❌ | ❌ |
| `portal_users` | — | ❌ | ❌ | ❌ | ❌ |
| `portal_sessions` | — | ❌ | ❌ | ❌ | ❌ |
| `portal_audit_log` | — | ❌ | ❌ | ❌ | ❌ |

Обоснование исключений:

- **`staffing_demand` — единственная таблица с delete-политикой.** Очистка
  ячейки в матрице это физическое удаление строки (у таблицы нет
  `archived_at`), поэтому право на `delete` необходимо для работы UI. Оно
  осталось у всех, у кого есть раздел «Потребность»: это штатное действие
  координатора, а не административная операция.
- **`candidates`, `candidate_list_options` и `addresses` без delete** —
  используется soft-delete: `archived_at` у кандидатов и адресов, `is_active
  = false` у справочников. У `addresses` доступ ко всем трём операциям
  (`select`/`insert`/`update`) есть у всех четырёх ролей — единственная
  таблица данных, не ограниченная по ролям так же строго, как остальные.
- **`candidate_list_options`: читают все, правит только «Настройки».**
  Подсказки нужны в карточке кандидата любой роли, а редактируются лишь в
  одном месте.
- **`rate_cards`/`rates` — вторая пара таблиц с delete-политикой**, вместе
  со `staffing_demand`. У «Ставок» нет соображений для истории устаревшего
  тарифа, поэтому удаление — обычный `DELETE`, а не `archived_at`. Доступ ко
  всем четырём операциям есть у всех четырёх ролей, как у `addresses` —
  «Ставки» не ограничены по ролям так же строго, как большинство разделов.
- **`staffing_demand_history` только на чтение** — записи создаются
  исключительно триггерами `log_staffing_demand_change` и
  `log_staffing_demand_rows_change` (`SECURITY DEFINER`).
- **`address_demand_history` — читает аудитория «Потребности», пишет
  аудитория «Адресов», обе стороны — в рамках своего проекта.** `select`
  проверяет `portal_can('demand') and portal_has_project(project)` (не
  `addresses`), иначе менеджер/координатор не увидел бы залоченные
  вычисленные ячейки матрицы через `staffing_demand_effective()`, хотя сам
  раздел «Адреса» ему не доступен. `insert`/`update`/`delete` —
  `portal_can('addresses') and portal_can('settings') and
  portal_has_project(project)`: пишет только пайплайн импорта
  (`src/lib/imports/`), не UI «Потребности» напрямую. Прецедент на
  `portal_has_project` для записи — `addresses` (H-6 project-scoped её
  `insert`/`update`), не `staffing_demand_imports` (она заведена до H-6 и
  project вообще не проверяет) — без этой проверки координатор одного
  проекта мог бы вставить или удалить снимок истории чужого проекта.
  `delete` есть (в отличие от `staffing_demand_history`) — нужен откату
  импорта (`revertImport.ts`).
- **Пять таблиц раздела «Описание вакансии» — единственный случай, где
  запись строже чтения на уровне одного раздела.** Читают все, у кого есть
  `vacancies` (все 4 роли — раздел виден всем, как «Адреса»/«Ставки»), но
  `insert`/`update`/`delete` дополнительно требуют `portal_can('settings')` —
  тот же приём, что уже применяет `candidate_list_options` (settings есть
  только у head/coordinator в `roles.ts`), а не отдельная функция проверки
  роли. `vacancy_projects` без delete (soft-delete через `archived_at`, как
  `addresses`); у трёх дочерних таблиц delete есть — это настоящее удаление
  строки поля/раздела/вложения (не самой вакансии), их история переживает
  удаление в `vacancy_history`. Основной путь записи для UI — RPC
  `portal_save_vacancy_project_tree`/`portal_duplicate_vacancy_project`
  (`SECURITY DEFINER`, проверяют то же самое условие сами, независимо от
  политик таблиц); прямые политики — вторая линия защиты и путь для точечных
  операций вроде архивации всей вакансии.
- **Три таблицы `portal_*` закрыты полностью** — ни одной политики, гранты
  отозваны. Работа с ними идёт только через `SECURITY DEFINER` функции,
  которые сами проверяют право вызывающего. Поэтому `password_hash` не может
  уехать клиенту: маршрута, который бы его вернул, не существует.

## Функции доступа

| Функция | Кому доступна | Назначение |
|---|---|---|
| `portal_can(section)` | anon, authenticated | Есть ли у запроса доступ к разделу. Используется в политиках. С `20260811100200` — синоним `portal_can_view_section` |
| `portal_can_view_section(section)` | anon, authenticated | Фаза A: может ли открыть раздел и читать данные. Для `select`-политик. **Пока не используется ни одной политикой** |
| `portal_can_edit_section(section)` | anon, authenticated | Фаза A: может ли изменять данные раздела. Для `insert`/`update`/`delete`. Проверять `can_view` отдельно не нужно — гарантировано `check`-инвариантом. **Пока не используется ни одной политикой** |
| `portal_section_order()` | anon, authenticated | Фаза A: канонический список прав в порядке меню (10 разделов + `users`). Задаёт допустимые значения `section` и порядок в `portal_role_sections()` |
| `portal_has_project(project)` | anon, authenticated | H-6: есть ли доступ к проекту. `head` — всегда `true` (bypass), `all_projects = true` — тоже; остальные — `project = any(portal_users.projects)` |
| `portal_has_rate_card_project(rate_card_id)` | anon, authenticated | H-6: то же самое для `rates` — своей колонки `project` нет, ищет её через `rate_cards` |
| `portal_role_sections(role)` | anon, authenticated | Матрица «роль → разделы» в порядке меню. С `20260811100200` читает `portal_section_permissions`; сигнатура и результат прежние, но функция стала `stable` + `security definer` (см. ADR-005) |
| `portal_save_vacancy_project_tree(project_id, expected_version, payload)` | authenticated | TASK-010: атомарное сохранение дерева вакансии (проект+разделы+поля+вложения), проверяет `vacancies`+`settings` и `version` (оптимистическая блокировка) сама |
| `portal_duplicate_vacancy_project(project_id)` | authenticated | TASK-010: копирует вакансию целиком под новым id, та же проверка доступа |
| `search_vacancy_projects(query)` | authenticated | TASK-010: substring-поиск id вакансий по названию/разделам/полям; пусто, если нет `vacancies` |
| `staffing_demand_effective(p_from, p_to)` | authenticated | 20260807100300: читает `staffing_demand`+`address_demand_history` за диапазон дат. Обычная `language sql` функция без `SECURITY DEFINER` — выполняется с правами вызывающего, RLS обеих таблиц применяется как при прямом `SELECT`, отдельных прав не требует |
| `portal_current_user_id()` / `portal_current_session_id()` | anon, authenticated | Claim'ы `sub` / `sid` текущего JWT |
| `portal_login`, `portal_session_context`, `portal_logout` | anon, authenticated | Вход, проверка сессии, выход |
| `portal_admin_*` | authenticated | Управление пользователями и журнал. Внутри — `portal_require_admin()` |
| `portal_require_admin`, `portal_user_json`, `portal_assert_password` | — | Внутренние помощники, грантов нет |
| `portal_bootstrap_admin` | — | Первый администратор, только владельцем из SQL-редактора |

## Ключи и аутентификация

- В приложении используется **только publishable-ключ**. `service_role` в
  коде отсутствует.
- Supabase Auth не используется. Пароли лежат в `portal_users.password_hash`
  (bcrypt через `pgcrypto`), сессии — в `portal_sessions` (в базе только
  sha256 от токена).
- Токен доступа к данным портал подписывает сам секретом проекта
  (`SUPABASE_JWT_SECRET`), с `role: authenticated` и `sub` = id пользователя
  портала. Поэтому `auth.uid()` продолжает работать, и `changed_by` в истории
  «Потребности» по-прежнему проставляет база, а не клиент.

> Примечание: комментарий в самой первой миграции (`20260721133910`) упоминает
> `service_role` как временную модель до появления auth. Он **устарел**.
> Комментарии в миграциях `20260721202609` и `20260724100100` про
> «любой авторизованный сотрудник» тоже описывают прежнюю модель — политики
> из них удалены миграцией `20260728120000`.

## Ограничения текущей модели

Осознанный долг, зафиксированный явно:

1. ~~Нет разграничения по проектам~~ — **закрыто H-6** (3 августа 2026).
   Остаток долга: разграничение сейчас на уровне строк (какие проекты видны),
   не на уровне колонок (см. пункт 2 ниже) — увидев кандидата своего проекта,
   сотрудник видит все его поля, включая PII.
2. **Вся PII доступна всем ролям с разделом «Кандидаты»** — то есть всем
   четырём, в рамках их проектов после H-6. ФИО, телефон, telegram,
   `salary_card`. Для 152-ФЗ это требует внимания — отдельная задача
   column-level protection, не входит в H-6.
3. **Матрица прав продублирована** в SQL (`portal_role_sections`) и TS
   (`src/lib/auth/roles.ts`). Рассинхронизацию не поймают ни типы, ни тесты.
   Частично закрыто фазой A: SQL-сторона больше не хардкод, а таблица
   `portal_section_permissions`, и расхождение с `roles.ts` теперь ловит
   `sectionPermissionsSeed.test.ts` на каждом прогоне. Но `roles.ts` пока
   остаётся рантайм-источником прав для фронтенда — окончательно дубль
   уйдёт в фазах D/E, когда матрица поедет клиенту из базы.
4. **`portal_login` доступен `anon`** — иначе форма входа не работала бы.
   Защита от перебора: 10 неудачных попыток на логин за 15 минут.
5. **Нет автоматических тестов RLS** (находка H-13, отдельная) — матрица
   прав, включая теперь и проектную проверку, проверена вручную (`curl`
   против реального PostgREST под несколькими ролями, см.
   `docs/ROLLOUT-project-access.md`), но регрессию в будущей миграции
   поймать некому.

## Как проверить политики в боевой базе

```bash
npx supabase db query --linked "select tablename, policyname, cmd, roles::text, qual::text from pg_policies where schemaname='public' order by tablename, cmd"
```

Проверить гранты на функции:

```bash
npx supabase db query --linked "select p.proname, array_agg(a.rolname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace left join aclexplode(p.proacl) x on true left join pg_roles a on a.oid=x.grantee where n.nspname='public' and p.proname like 'portal%' group by p.proname order by p.proname"
```

Оба запроса read-only и безопасны для прода.
