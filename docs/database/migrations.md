# Миграции

`supabase/migrations/*.sql` — **единственный источник истины** для схемы базы.
Структура таблиц описана в [`schema.md`](schema.md), политики доступа —
в [`policies.md`](policies.md).

## Правила

1. Любое изменение схемы — **новая** миграция. Уже применённые миграции
   не редактируются никогда, даже ради опечатки в комментарии.
2. После применения — **регенерация типов**:
   `npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts`.
3. `database.types.ts` — генерируемый файл, вручную не правится.
4. Названия полей и enum не меняются без отдельного согласования и миграции.
5. Названия проектов и стадий заданы бизнесом дословно — не переименовываются.
6. Миграции пишутся **аддитивными и идемпотентными** там, где это возможно
   (`if not exists`, `on conflict do nothing`).
7. Миграция применяется к боевой базе **только по прямой команде** — у проекта
   один Supabase-контур, отдельного dev-стенда нет.

## Порядок применения

```bash
npx supabase migration list --linked   # что применено, что нет
npx supabase db push --linked          # применить недостающие
```

Каждый файл выполняется **в одной транзакции**. Отсюда важное практическое
следствие: **нельзя добавить значение enum и тут же его использовать в том же
файле** — Postgres запрещает применять новое значение enum в транзакции,
которая его создала. Такие изменения разбиваются на две миграции (пример —
`20260725100000` + `20260725100100`).

## Проверка после применения

```bash
# состояние колонок
npx supabase db query --linked "select table_name, column_name, is_nullable from information_schema.columns where table_schema='public' and table_name='<таблица>'"

# ограничения
npx supabase db query --linked "select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid='<таблица>'::regclass"
```

Проверять backfill фактическими данными, а не только структурой: `NOT NULL`
без корректного backfill упадёт на применении, а некорректный backfill
применится молча.

## Список миграций

| Файл | Что делает |
|---|---|
| `20260721133910_create_candidates_table.sql` | Таблица `candidates`, enum `candidate_project` / `candidate_stage`, индексы, триггер `updated_at`, расширение `pg_trgm` |
| `20260721202609_candidates_rls_policies.sql` | RLS-политики `candidates` для `authenticated` |
| `20260722213735_candidate_list_options.sql` | Справочники подсказок: таблица + enum `candidate_list_type` |
| `20260722214949_candidate_list_options_order_active.sql` | `sort_order` и `is_active`, удаление delete-политики |
| `20260724100000_create_staffing_demand.sql` | Таблица `staffing_demand` (потребность по дате), unique `(project, city, demand_date)` |
| `20260724100100_staffing_demand_rls_policies.sql` | RLS-политики `staffing_demand`, включая **delete** |
| `20260724120000_create_staffing_demand_rows.sql` | `staffing_demand_rows` — статус и комментарий строки |
| `20260724130000_create_staffing_demand_history.sql` | `staffing_demand_history` + два `SECURITY DEFINER`-триггера аудита |
| `20260725100000_add_position_list_type.sql` | Значение `position` в enum `candidate_list_type` |
| `20260725100100_seed_positions_and_candidate_position.sql` | Засев 21 должности + колонка `candidates.position` |
| `20260727090000_add_position_to_staffing_demand.sql` | `position` в потребность, unique → `(project, city, position, demand_date)` |
| `20260727090100_add_position_to_staffing_demand_rows.sql` | `position` в метаданные строки, unique → `(project, city, position)` |
| `20260727090200_add_position_to_staffing_demand_history.sql` | `position` в аудит + пересборка обеих триггерных функций |
| `20260728120000_portal_auth.sql` | Встроенная авторизация: `portal_users` / `portal_sessions` / `portal_audit_log`, enum `portal_user_role` и `portal_audit_action`, функции `portal_*`, переезд всех политик данных на `portal_can(<раздел>)` |
| `20260729130000_create_addresses.sql` | Таблица `addresses` (раздел «Адреса»), text+CHECK вместо enum для `object_type`/`status`/`schedule_type`/`shift_type`/`payment_type`, индексы, триггер `set_addresses_audit_fields()` (`created_by`/`updated_by` + снимок логина) |
| `20260729130100_addresses_rls_policies.sql` | RLS-политики `addresses` (`select`/`insert`/`update` на `portal_can('addresses')`, без `delete` — soft-delete как у `candidates`) |
| `20260729130200_update_portal_role_sections_addresses.sql` | Добавляет `'addresses'` во все четыре роли в `portal_role_sections()` — раздел видят все, в отличие от большинства |
| `20260731100000_rates_list_types.sql` | Значения `project`/`legal_entity` в enum `candidate_list_type` (раздельно от следующей миграции — новое значение enum нельзя использовать в той же транзакции) |
| `20260731100100_create_rates.sql` | Таблицы `rate_cards` (блок условий) и `rates` (строка тарифа, FK `rate_card_id ... on delete cascade`), text+CHECK для `unit`/`schedule`/`office_status`, индексы, общий триггер `set_rates_audit_fields()`, засев 25 проектов и 11 юр. лиц в `candidate_list_options` |
| `20260731100200_rates_rls_policies.sql` | RLS-политики `rate_cards`/`rates` (`select`/`insert`/`update`/**`delete`** на `portal_can('rates')` — настоящий `delete`, как у `staffing_demand`, не soft-delete) |
| `20260731100300_update_portal_role_sections_rates.sql` | Добавляет `'rates'` во все четыре роли в `portal_role_sections()` — раздел видят все, как «Адреса» |
| `20260731120000_unify_project_free_text.sql` | `candidates.project` / `staffing_demand.project` / `addresses.project`: `alter column ... type text` (были enum `candidate_project`) — сводит список проектов во всём портале к одному управляемому справочнику `candidate_list_options` (`list_type = project`), которым до этого пользовались только «Ставки». Enum не удалён, просто больше не используется как тип колонки |
| `20260801100000_login_rate_limit.sql` | Применена. Фаза 1 защиты входа (C-3/C-4): таблица `portal_login_attempts`, функция ретенции `portal_purge_login_attempts()`, роль `portal_auth_caller`, пересоздание `portal_login` с параметром `p_ip` — ограничение частоты по источнику вместо блокировки учётной записи. `anon`-гранты сохранены. См. раздел ниже |
| `20260802200000_login_rate_limit_revoke_anon.sql` | Применена 2 августа 2026. Фаза 3: `revoke execute ... from anon` на всех трёх auth-функциях. Верифицировано `curl`: прямой вызов от `anon` отвергается (`42501`) на всех трёх; вызов через приложение (`portal_auth_caller`) продолжает работать. **C-3/C-4 закрыты полностью** |
| `20260803120000_addresses_document_links_check.sql` | H-3: функция `addresses_document_links_valid()` + `CHECK`-ограничение на `addresses.document_links` — форма `[{id,title,url,type}]` и `url` только `http(s)`, второй уровень защиты от хранимой XSS поверх валидации в `AddressDrawer.tsx`. Read-only проверка перед применением подтвердила отсутствие нарушающих строк — backfill не потребовался |
| `20260803130000_project_access_functions.sql` | H-6, фаза A. Функции `portal_has_project(text)` и `portal_has_rate_card_project(uuid)` — аддитивные, никем не вызываются, поведение не меняется. `head` — bypass (см. определение функции), остальные роли — проверка `project = any(portal_users.projects)` |
| `20260803140000_project_scoped_rls_policies.sql` | H-6, фаза C. Переписаны 22 политики на 7 таблицах (`candidates`, `staffing_demand`, `staffing_demand_rows`, `staffing_demand_history`, `addresses`, `rate_cards`, `rates`) — к существующей проверке `portal_can(<раздел>)` добавлено `and portal_has_project(project)` (для `rates` — `portal_has_rate_card_project(rate_card_id)`, у неё нет своей колонки `project`). Read-only аудит фазы B и точные определения политик до миграции — `docs/ROLLOUT-project-access.md` |
| `20260803150000_fix_set_user_active_audit_cast.sql` | Не связано с H-6, найдено при его тестировании. `create or replace` на `portal_admin_set_user_active()` — добавлен явный `::portal_audit_action` на `CASE`-выражение в `INSERT` в `portal_audit_log`; без каста функция падала с `42804` на **любом** вызове (и включение, и отключение доступа), с момента создания. Переключатель «Активен» в «Команда и роли» был полностью нерабочим — обнаружено впервые только сейчас, потому что раньше в проекте не было второй учётной записи, чтобы его переключить |
| `20260805100000_create_vacancy_projects.sql` | TASK-010. Корень раздела «Описание вакансии» — таблица `vacancy_projects` (без `slug`: селектор — `id`), `category_option_id` — настоящий FK на `candidate_list_options` (не свободный текст, как `project`/`city`/`position` в остальных разделах), `version` для оптимистической блокировки, триггер `set_vacancy_projects_audit_fields()`, trigram-индекс по `title` |
| `20260805100100_create_vacancy_sections.sql` | Таблица `vacancy_sections` — полностью произвольные разделы (без `template`/enum), `is_system` — единственный функциональный флаг (раздел «Общая информация») |
| `20260805100200_create_vacancy_fields.sql` | Таблица `vacancy_fields` — пары `label`/`value`, `field_type` text+CHECK на 8 значений (`text`/`textarea`/`rich_text`/`link`/`number`/`date`/`checkbox`/`select` — `select` зарезервирован, редактор не построен) |
| `20260805100300_create_vacancy_attachments.sql` | Таблица `vacancy_attachments` — внешние ссылки, обязательная привязка к вакансии, необязательная — к разделу (`on delete set null`, вложение переживает удаление раздела) |
| `20260805100400_create_vacancy_history.sql` | Таблица `vacancy_history` (только `select` для `authenticated`) + 4 `SECURITY DEFINER`-триггера, пишущие `to_jsonb(old)`/`to_jsonb(new)` при любом изменении проекта/раздела/поля/вложения |
| `20260805100500_vacancy_projects_rls_policies.sql` | RLS для всех пяти таблиц — `select` на `portal_can('vacancies')` (все 4 роли), `insert`/`update`/`delete` — `... and portal_can('settings')` (только head/coordinator, тот же приём, что у `candidate_list_options`) |
| `20260805100600_vacancy_projects_rpc.sql` | `SECURITY DEFINER`-функции `portal_save_vacancy_project_tree` (атомарное сохранение дерева с проверкой `version`), `portal_duplicate_vacancy_project`, `search_vacancy_projects` (substring-поиск по всем вакансиям) + trigram-индексы на `vacancy_fields.label`/`value`, `vacancy_sections.title`. Правлена после первой попытки применения: `search_vacancy_projects` падала с `42P10` (`ORDER BY vp.title` при `SELECT DISTINCT vp.id` — title не входил в список distinct); исправлено через подзапрос. Все три функции — `create or replace`, не `create`, чтобы повторный запуск после частичного сбоя был безопасен |
| `20260805100700_add_vacancy_category_list_type.sql` | Значение `vacancy_category` в enum `candidate_list_type` (отдельно — та же причина, что у `20260725100000`) |
| `20260805100800_seed_vacancy_categories.sql` | Засев 7 категорий (те же, что были захардкожены в старом `vacancyData.ts`) в `candidate_list_options` |
| `20260805110000_add_demand_import_support.sql` | Импорт потребности из Excel (раздел «Адреса»). `staffing_demand`: `+address text NULL`, `+source text NOT NULL DEFAULT 'manual'`, `+import_id uuid` (FK на новую таблицу); unique-констрейнт расширен полем `address`. Новые таблицы `project_import_configs` (парсер+маппинг колонок на проект, засеяны 4 временных generic-конфига) и `staffing_demand_imports` (история с `error_log`/`warnings` в jsonb). RLS — `portal_can('addresses') and portal_can('settings')`, тот же приём, что у записи в раздел «Описание вакансии». **Колонки, добавленные тут в `staffing_demand`, импорт больше не использует** — см. `20260807100000` |
| `20260807100000_addresses_import_source.sql` | Импорт пишет в «Адреса», а не в «Потребность»: `addresses` `+source text NOT NULL DEFAULT 'manual'` (`check in ('manual','excel')`), `+import_id uuid` (FK на `staffing_demand_imports`), индекс по `import_id`. Уникального индекса по (project, city, full_address, position) намеренно нет — в таблице уже могут быть ручные дубликаты, сопоставление делается в приложении (`addressPlan.ts`) |
| `20260807100100_lavka_conditions_mapping.sql` | Только данные, без DDL: в `column_mapping` конфига `lavka_v1` добавлены колонки условий («Метро», «График», «Ночной формат работы», «Разгрузка»), `version` → 2. `parser_key` не меняется — структура файла та же, парсер просто начал читать столбцы, которые в нём и так были. jsonb-конкатенация (`||`) — идемпотентно и не затирает ручные правки конфига |
| `20260807100200_import_sync_mode.sql` | Режим «Синхронизировать»: CHECK на `staffing_demand_imports.mode` расширен до `('replace','add','sync')`, `+zeroed_rows integer NOT NULL DEFAULT 0`. Нужен, потому что выгрузка тикетов показывает только открытые позиции — закрытый объект из неё исчезает, и без обнуления карточка навсегда сохраняет старое `required_count` |
| `20260807100300_address_demand_history.sql` | Дата потребности + история по адресам. Новая таблица `address_demand_history` (снимок `required_count` по адресу и дате, `unique (address_id, demand_date)`, индекс `(demand_date, project, city, position)` — **ведущая `demand_date`**, не `project`, см. `schema.md`), RLS (`select` на `portal_can('demand')`, запись — на `portal_can('addresses') and portal_can('settings')`); `staffing_demand_imports` `+demand_date date NULL`; функция `staffing_demand_effective(p_from, p_to)` — `FULL OUTER JOIN` `staffing_demand`×агрегата `address_demand_history`, `language sql stable` (без `SECURITY DEFINER` — `SECURITY INVOKER` по умолчанию), обоснование выбора функции вместо `VIEW` и `FULL OUTER JOIN` вместо `LEFT JOIN`/`UNION ALL` — в `schema.md`. Не меняет схему `staffing_demand`/`addresses` |
| `20260808100000_add_stage_terminated.sql` | Значение `Уволился` в enum `candidate_stage` — отдельно (та же причина, что у `20260725100000`). Применена 8 августа 2026 (`supabase db query -f`, см. примечание ниже) |
| `20260808100100_add_termination_list_types.sql` | Значения `termination_reason`/`return_reason` в enum `candidate_list_type` — отдельно от следующей миграции (та же причина). Применена 8 августа 2026 |
| `20260808100200_add_candidate_termination_fields.sql` | `candidates` `+termination_reason text`, `+terminated_at timestamptz`, `+return_reason text`, индекс по `terminated_at`. Применена 8 августа 2026 |
| `20260808100300_seed_termination_return_reasons.sql` | Засев 12 причин увольнения и 9 причин возвращения в `candidate_list_options`, формулировки от бизнеса. Применена 8 августа 2026 |
| `20260811100000_portal_section_permissions.sql` | **Применена 11 августа 2026.** Новая модель доступа, фаза A (ADR-005). Функция `portal_section_order()` (канонический список прав + порядок меню), таблица `portal_section_permissions` (`role`/`section`/`project` nullable/`visible`/`can_view`/`can_edit`) с инвариантами `can_edit => can_view => visible`, два частичных unique-индекса (обычный не годится: `NULL` не конфликтует с `NULL`), RLS без политик + отзыв грантов, baseline seed на 44 строки. Аддитивная: ничего её пока не читает |
| `20260811100100_portal_users_all_projects.sql` | **Применена 11 августа 2026.** `portal_users` `+all_projects boolean not null default false` — доступ ко всем проектам, включая будущие, без перечисления руками. Все существующие учётки получают `false`, `projects` не трогается. На поведение не влияет до следующей миграции |
| `20260811100200_portal_section_permission_functions.sql` | **Применена 11 августа 2026.** `portal_can_view_section(text)` / `portal_can_edit_section(text)`; `portal_can(text)` → синоним VIEW; `portal_role_sections(role)` переписана на чтение таблицы. Сигнатура и результат последней прежние, но волатильность `immutable` → `stable` (читает таблицу) и добавлен `security definer` (иначе RLS вернула бы пустой массив). **Политики RLS не трогаются** |
| `20260811100300_portal_has_project_all_projects.sql` | **Применена 11 августа 2026.** `portal_has_project()` учитывает `all_projects`. Обе прежние ветки сохранены буква в букву: `head` — bypass как был, иначе `project = any(projects)`. Архитектура H-6 не меняется |

| `20260811110000_rls_view_edit_data_tables.sql` | **Применена 11 августа 2026.** Фаза C1: 22 политики на 7 проектных таблицах (`candidates`, `staffing_demand`, `_rows`, `_history`, `addresses`, `rate_cards`, `rates`) переведены на `portal_can_view_section` (select) / `portal_can_edit_section` (insert/update/delete). Проектная проверка H-6 перенесена дословно. Поведение не меняется |
| `20260811110100_rls_view_edit_settings_gated.sql` | **Применена 11 августа 2026.** Фаза C2: `candidate_list_options` (3) и `address_demand_history` (4). Административный гейт **сохранён** как `portal_can_edit_section('settings')` — перевод на `can_edit` своего раздела выдал бы manager/recruiter права, которых у них нет. Поведение не меняется |
| `20260811110200_rls_view_edit_vacancies.sql` | **Применена 11 августа 2026.** Фаза C3: 16 политик на пяти `vacancy_*` + три `SECURITY DEFINER`-функции (`portal_save_vacancy_project_tree`, `portal_duplicate_vacancy_project`, `search_vacancy_projects`). Связка `vacancies + settings` растворена в `portal_can_edit_section('vacancies')` — различие уже несёт baseline. Поведение не меняется |
| `20260811110300_rls_import_tables_project_scope.sql` | **Применена 11 августа 2026. Единственная миграция фазы C, меняющая поведение.** `project_import_configs` (`for all` разбита на insert/update/delete) и `staffing_demand_imports` получают `portal_has_project(project)` — закрытие пробела H-6. Координатор перестаёт видеть импорты чужих проектов; `head` не затронут |

### Фазы A и C новой модели доступа — применены к бою

Все восемь миграций применены к боевой базе **11 августа 2026**, по одной,
через `supabase db query --linked -f <файл>`, с проверкой после каждой.
Порядок был обязателен: `20260811100300` читает колонку из
`20260811100100`, `20260811100200` — таблицу из `20260811100000`, а C1–C4
вызывают функции из `20260811100200`.

Перед выкатом прогон CI (джоба `rls-tests`) подтвердил все восемь на
эфемерном Postgres — 59 RLS-тестов. Локально проверить нечем: на машине
разработки нет Docker.

Состояние production после выката:

| Проверка | Значение |
|---|---|
| Политик в `public` | **52** (было 50) |
| `select` → `portal_can_view_section` | 16 |
| запись → `portal_can_edit_section` | 36 |
| со старым `portal_can(...)` | **0** |
| с проектным гейтом | 33 (было 26, +7 от C4) |
| `using (true)` | 0 |
| `portal_role_sections()` | совпал с `roles.ts` побайтово для всех 4 ролей, включая порядок |
| `portal_section_permissions` | 44 seed-строки, 3 CHECK, RLS без политик |

**Важно про способ применения.** `supabase db query --linked -f` **не**
записывает версию в `supabase_migrations.schema_migrations` — именно так
возникала прежняя рассинхронизация (см. раздел ниже). После каждого файла
версия дописывалась вручную:

```sql
insert into supabase_migrations.schema_migrations (version)
values ('<version>') on conflict (version) do nothing;
```

Итог: 54 записи в истории против 54 файлов локально, расхождений нет.

**Откат.** Повторное выполнение файла с прежними определениями:
`20260803140000` (C1), `20260728120000`/`20260807100300` (C2),
`20260805100500`/`20260805100600` (C3), `20260805110000` — только секция
Row Level Security (C4). C1–C3 от C4 не зависят, поэтому C4 откатывается
отдельно. **Обратной миграции для фазы A не написано** — если понадобится,
это отдельная задача.

## Известная проблема: таблица истории миграций рассинхронизирована с реальной схемой

Обнаружено 8 августа 2026 при попытке `supabase db push --linked`: команда
отказалась выполняться (`LegacyDbPushMissingRemoteError`), а после
`--include-all` немедленно упала на `create table public.addresses` с
`ERROR: relation "addresses" already exists`. Проверка `information_schema`
показала, что **таблицы `addresses`, `vacancy_projects`/`vacancy_sections`/
`vacancy_fields`/`vacancy_attachments`/`vacancy_history`,
`project_import_configs`, `staffing_demand_imports`,
`address_demand_history` уже существуют** на боевой базе — то есть миграции
`20260729130000`…`20260807100300` (17 файлов) физически применены, но не
записаны в `supabase_migrations.schema_migrations` (последняя учтённая там
запись — `20260803150000`). Судя по всему, все они выполнялись вручную через
SQL Editor Supabase, а не через `supabase db push`.

Три миграции `20260808100000`…`20260808100200` из этой находки применены
точечно, через `supabase db query --linked -f <файл>` по одному, а не через
`db push` — с проверкой каждого шага (`pg_enum`/`information_schema.columns`)
после применения.

**Рассинхронизация устранена** (8 августа 2026): `supabase migration repair
--linked` не смог подключиться из этой среды (нужно прямое подключение к
Postgres на 5432/6543, а окружение видит только HTTPS до Management API,
которым пользуется `db query`) — `LegacyDbExecError: Connection error` на
каждой попытке. Вместо этого 20 недостающих версий (17 старых + 3 из этой
задачи) дописаны напрямую тем же путём, что и обычно работал —
`supabase db query --linked`:

```sql
insert into supabase_migrations.schema_migrations (version)
values ('20260729130000'), ..., ('20260808100200')
on conflict (version) do nothing;
```

`name`/`statements` оставлены `NULL` — так же, как у всех остальных строк
таблицы на этом проекте (репозиторий никогда их не заполнял, значит это не
отступление от нормы). Проверено: `supabase migration list --linked`
показывает совпадение `local`/`remote` по всем миграциям, `supabase db push
--linked --dry-run` (без `--include-all`) отвечает `"Remote database is up
to date."` — `db push` снова можно использовать в обычном режиме для
следующих миграций.

## Миграция `20260728120000_portal_auth.sql`: что учесть при применении

Самая крупная миграция проекта — она меняет модель доступа целиком.

1. **Требуется `pgcrypto`.** Расширение ставится идемпотентно (`extensions`,
   иначе `public`), функции работают с `search_path = public, extensions`.
2. **Старые политики удаляются.** `authenticated_*` на `candidates`,
   `candidate_list_options`, `staffing_demand`, `staffing_demand_rows`,
   `staffing_demand_history` заменяются на `portal_*` с проверкой
   `portal_can()`. Откат = обратная миграция, а не правка этой.
3. **Сразу после применения данные не читаются никем** — пока не создан
   первый пользователь и портал не выдаёт JWT. Это ожидаемо.
4. **Первый администратор заводится вручную, один раз**, из SQL-редактора
   Supabase (функция работает, только пока таблица пуста, и никому не выдана
   по грантам):

   ```sql
   select public.portal_bootstrap_admin('admin', 'Имя Фамилия', '<пароль>');
   ```

   Дальше пользователи создаются только в портале. Пароль в репозиторий и в
   документацию не попадает — в этом и смысл отдельной функции вместо
   засева дефолтной учётки.
5. **Нужна переменная `SUPABASE_JWT_SECRET`** в `.env.local` и в настройках
   Vercel — без неё вход пройдёт, но данные не загрузятся.
6. **`database.types.ts` требует регенерации** после применения:
   `npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts`.
   До этого новые таблицы и функции типизированы вручную в
   `src/lib/supabase/portalAuth.types.ts`.

## Backfill: принятое соглашение

Три миграции от `20260727` добавляли обязательную колонку `position` в таблицы
с уже существующими данными. Принятое решение — backfill значением `'Курьер'`
(самая массовая должность), затем `set not null`.

Сознательная цена: единственная запись в `staffing_demand_history`, сделанная
до появления должностей, задним числом получила `position = 'Курьер'`, хотя
к этой должности отношения не имела. Выбрано ради того, чтобы `position` был
`NOT NULL` во всех трёх таблицах и в коде нигде не появлялась ветка
`if (position === null)`.

## Чего в схеме пока нет

Осознанно отложено, зафиксировано в [`../tasks/backlog.md`](../tasks/backlog.md):

- разграничения данных по проектам (`portal_users.projects` есть, фильтрации
  по нему нет);
- очистки истёкших строк `portal_sessions`;
- журнала изменений кандидатов **и адресов** (полноценный построчный аудит,
  как у потребности, есть только у неё и у пользователей). У `addresses` пока
  только снимок «кто/когда» в самой строке (`created_by*`/`updated_by*`) — не
  замена полной истории, задел на следующую задачу;
- `updated_by` в `candidates`/`staffing_demand*` — известно только *когда*
  изменено, не *кем* (у `addresses` это уже решено, см. выше);
- ограничений длины у текстовых полей;
- партиционирования и политики хранения для растущей `staffing_demand_history`
  и `address_demand_history` (обе — append-only журналы без плана
  автоматического архивирования; для `address_demand_history` политика
  хранения и масштабируемость на несколько лет уже разобраны в `schema.md`,
  но само партиционирование не реализовано — не нужно на текущем объёме).

`20260729130000_create_addresses.sql` (и две последующие), `20260728120000_portal_auth.sql`,
`20260731100000_rates_list_types.sql`…`20260731100300_update_portal_role_sections_rates.sql`
и `20260731120000_unify_project_free_text.sql` **применены к боевой БД**;
`database.types.ts` регенерирован — `addresses`, `rate_cards`/`rates`,
`portal_users`/`portal_sessions`/`portal_audit_log` и свободнотекстовые
`project` в `candidates`/`staffing_demand`/`addresses` в нём отражены (см.
`schema.md`). После применения `20260731120000` проверено читающим
запросом: во всех трёх таблицах 0 строк с `NULL`/пустым `project`, ни одно
значение не выпадает из `candidate_list_options` (`list_type = project`) —
перенос данных прошёл без потерь.

Технически применены не через `supabase db push` (в среде разработки
заблокирован прямой Postgres-протокол, порты 5432/6543 — доходит только
HTTPS до Management API), а вручную через SQL Editor Supabase, с ручной
регистрацией версий в `supabase_migrations.schema_migrations` — файлы
миграций от этого не отличаются от применённых штатным способом.

**`20260805100000`…`20260805100800` (TASK-010, «Описание вакансии») ещё не
применены** — написаны в этой задаче, но не выкатывались против боевой БД и
не регенерировали `database.types.ts`; `src/lib/supabase/vacancyProjects.types.ts`
и репозитории раздела выведены из `Database` так, как будто миграция уже
применена (см. комментарий в начале файла типов) — до применения `npm run
typecheck`/`npm run build` показывают ошибки конкретно в файлах раздела
`vacancies`, это ожидаемо. Порядок применения: сначала `20260805100000`…
`20260805100600` (таблицы, триггеры, RLS, RPC), затем — обязательно
отдельно — `20260805100700` (`ALTER TYPE ... ADD VALUE`, Postgres не
позволяет использовать новое значение в той же транзакции), затем
`20260805100800` (засев категорий). После применения — регенерация типов и
проверка под всеми четырьмя ролями по чек-листу.

**`20260805110000_add_demand_import_support.sql` применена к боевой БД** —
подтверждено ручным прогоном импорта через интерфейс (создались записи в
`project_import_configs`/`staffing_demand_imports`).

Все три миграции `20260807*` **идемпотентны** (`add column if not exists`,
`create index if not exists`, `drop constraint if exists`, jsonb-`||` вместо
перезаписи): порядок применения здесь не отслеживается раннером, файлы
запускаются руками через SQL Editor, поэтому повторный запуск не должен
падать с `42701: column already exists`.

**`20260807100100_lavka_conditions_mapping.sql` и
`20260807100200_import_sync_mode.sql` ещё не применены**
(`20260807100000_addresses_import_source.sql` — применена; первая из двух
оставшихся только правит данные в `project_import_configs` и типов не
касается) —
написана после того, как выяснилось, что импорт должен наполнять раздел
«Адреса», а не матрицу «Потребность». Как и с TASK-010, типы и репозитории
выведены из `Database` так, как будто миграция уже применена — вручную
дописаны поля `source`/`import_id` в блок `addresses` в
`database.types.ts` в отсутствие доступа к
`supabase gen types typescript` для реального проекта; после применения
миграции обязательно перегенерировать файл штатной командой и свериться,
что ручная правка совпала.

Колонки `address`/`source`/`import_id` в `staffing_demand` после смены
цели импорта не используются (их заполняет только ручной ввод значениями
по умолчанию). Они ничего не ломают; удаление — отдельная задача, если
понадобится чистка схемы.

**`20260807100300_address_demand_history.sql` применена к боевой БД**
(7 августа 2026, SQL Editor). Применение потребовало двух правок уже
написанного файла — оба нашлись только на реальном Postgres, ни разбор
плана, ни `typecheck`/`lint`/`test`/`build` (проверяют TS, не SQL) их не
могли поймать:

1. `42601: syntax error at or near "position"` в списке колонок `returns
   table`. `position` — зарезервированное слово Postgres
   (`POSITION(x IN y)`): как обычная колонка таблицы оно проходит без
   кавычек (`addresses`/`candidates`/`staffing_demand` уже так делают), но
   список колонок `returns table`/параметров функции разбирается по более
   строгим правилам, где это же слово без кавычек не проходит. Исправлено
   явными кавычками — `"position" text` — только в этом одном месте;
   везде в теле функции (`m.position`, `group by ... position`, `as
   position`) слово стоит в более permissive контексте (ссылка на колонку/
   алиас результата) и кавычек не требует.
2. `42883: function max(uuid) does not exist`. `uuid` поддерживает
   операторы сравнения (сортируется, участвует в `<`/`>`), но Postgres не
   регистрирует для него агрегат `max()`, в отличие от `text`/`int`/
   `timestamp`. Исправлено кастом через text: `max(import_id::text)::uuid`
   — какой конкретно `import_id` из нескольких адресов группы попадёт в
   отчёт, не имеет значения (поле нигде не читается бизнес-логикой
   «Потребности», только частью формы `StaffingDemandRow`), важно только
   не упасть.

Заодно, не дождавшись отдельной ошибки, добавлен явный `::integer` на
`sum(required_count)` — `sum(integer)` в Postgres возвращает `bigint`, а
`planned_count` в `returns table` объявлен `integer`; без каста это почти
наверняка следующая ошибка того же класса (`структура запроса не совпадает
с типом результата функции`).

`EXPLAIN ANALYZE select * from staffing_demand_effective(...)` на реальном
окне дат (подтверждение `Index Scan` по `idx_address_demand_history_date`,
не `Seq Scan`) и регенерация `database.types.ts` — ещё не сделаны, см.
`docs/tasks/current.md`.

`20260801100000_login_rate_limit.sql` **применена к боевой БД** (read-only
проверка раздела 1.2 подтверждена через SQL Editor).
`20260802200000_login_rate_limit_revoke_anon.sql` (фаза 3) — **применена**.
C-3/C-4 закрыты полностью.
См. следующий раздел, там же порядок выката.

## Миграция `20260801100000_login_rate_limit.sql`: трёхфазный выкат

> Пошаговая инструкция выката с точками отката, чек-листом ручного
> тестирования и разбором ложноположительных проверок —
> [`../ROLLOUT-login-rate-limit.md`](../ROLLOUT-login-rate-limit.md).
> Ниже — состав фаз и обоснование порядка.

Единственная миграция в проекте, которую **нельзя выкатывать одним шагом
вместе с кодом**. Причина: она меняет сигнатуру `portal_login` и вводит
доверенную роль, а неверный порядок оставит портал без возможности войти —
и чинить это придётся ещё одной миграцией.

### Фаза 1 — эта миграция

Только расширение возможностей. `anon`-гранты на `portal_login`,
`portal_session_context` и `portal_logout` **сохраняются**, старый путь
продолжает работать. Приложение при этом ничего не замечает: новый параметр
`p_ip` имеет значение по умолчанию, и существующий вызов с тремя
именованными аргументами остаётся корректным.

Защита в этой фазе ещё **не действует**: пока код не передаёт `p_ip`,
ограничение по источнику неактивно. Это осознанно — фаза 1 отвечает только
за то, чтобы ничего не сломать.

После применения — перезагрузить кэш схемы PostgREST (в Supabase это
происходит автоматически по событию DDL; если RPC отвечает «function not
found», подождать или дёрнуть `notify pgrst, 'reload schema'`).

#### Проверка после применения

Скрипт ниже писался в расчёте на отдельный стенд — он намеренно создаёт
неудачные попытки входа и безопасен только в этом смысле (использует
заведомо несуществующий логин), но пишет в `portal_login_attempts`.
**Отдельного стенда в проекте нет** (единственная база — она же боевая),
поэтому фактически была выполнена только **read-only часть** (пункты 1–2:
существование объектов, роль, гранты) — через SQL Editor, вручную, без
записи. Полный скрипт ниже оставлен как справочный и как инструкция для
среды, где стенд появится.

Поведенческая часть (пункты 3–7 ниже, а также срабатывание лимита и сброс
счётчика) верифицирована иначе — не этим скриптом, а прямым поведенческим
тестированием на production после деплоя фазы 2: см.
[`../ROLLOUT-login-rate-limit.md`](../ROLLOUT-login-rate-limit.md), раздел
«Итоги проверки фазы 2».

```sql
-- 1. Объекты на месте
select to_regclass('public.portal_login_attempts')            as table_ok,
       to_regprocedure('public.portal_login(text,text,text,text)') as login_4arg,
       to_regprocedure('public.portal_login(text,text,text)')      as login_3arg_gone,
       exists(select 1 from pg_roles where rolname = 'portal_auth_caller') as role_ok;
-- ожидается: table_ok и login_4arg заполнены, login_3arg_gone = NULL, role_ok = true

-- 2. Роль выдана authenticator и не имеет грантов на таблицы
select r.rolname as member
from pg_auth_members m
join pg_roles r on r.oid = m.member
join pg_roles g on g.oid = m.roleid
where g.rolname = 'portal_auth_caller';
-- ожидается: authenticator

select count(*) as table_grants
from information_schema.role_table_grants
where grantee = 'portal_auth_caller';
-- ожидается: 0

-- 3. Старый путь работает: три именованных аргумента, p_ip по умолчанию
select public.portal_login('нет-такого-логина', 'x', 'smoke-test') ->> 'reason';
-- ожидается: invalid_credentials

-- 4. Ограничение по источнику: 12 неудач с одного IP
do $$
begin
  for i in 1..12 loop
    perform public.portal_login('нет-такого-логина', 'x', 'smoke', '203.0.113.7');
  end loop;
end
$$;

select public.portal_login('нет-такого-логина', 'x', 'smoke', '203.0.113.7') as throttled;
-- ожидается: {"ok": false, "reason": "throttled", "retry_after": <секунды>}

-- 5. Другой источник не затронут — это и есть проверка, что C-4 не вернулся
select public.portal_login('нет-такого-логина', 'x', 'smoke', '198.51.100.4') ->> 'reason';
-- ожидается: invalid_credentials (НЕ throttled)

-- 6. В журнал попытки по несуществующему логину не пишутся (вторая половина C-3)
select count(*) as should_be_zero
from public.portal_audit_log
where action = 'login_failed' and details ->> 'login' = 'нет-такого-логина';
-- ожидается: 0

-- 7. Ретенция выполняется
select public.portal_purge_login_attempts(interval '0 seconds') as deleted;
-- ожидается: число удалённых строк > 0
```

Отдельно, под реальной учётной записью стенда, проверить **сброс счётчика
успешным входом**: сделать 10+ неудач с одного IP по существующему логину,
затем войти верно с того же IP — следующая попытка не должна получать
`throttled`. Это самостоятельный сценарий, потому что он проверяет
единственное место, где неудачи удаляются.

### Фаза 2 — код

Сервер начинает подписывать JWT с `role = portal_auth_caller` и передавать
IP в `p_ip`. **Деплоить только после подтверждённого применения фазы 1** —
иначе вызов уйдёт в несуществующую четырёхаргументную сигнатуру, и вход
перестанет работать. Репозиторий на `main` автодеплоится на Vercel, поэтому
код фазы 2 не должен попадать в `main` раньше применения миграции.

**Влито в `main` и задеплоено** (fast-forward `feat/auth-phase-2` → `main`,
коммит `0206a94`) — после подтверждённого применения фазы 1. Ветка была не
осторожностью, а механизмом: она делала «не выкатить раньше миграции»
свойством репозитория, а не тем, что надо помнить.

Что в ней сделано:

| Файл | Изменение |
|---|---|
| `lib/auth/jwt.ts` | `signPortalServiceJwt()` — отдельно от пользовательского токена, без `sub`/`sid`, с кэшем на 5 минут. Механика подписи вынесена в `signHs256()`; payload пользовательского токена не изменился |
| `lib/auth/session.ts` | `authDb()` ходит под `portal_auth_caller` через опцию `accessToken`; у `login()` появился обязательный аргумент `ip` |
| `app/api/auth/login/route.ts` | IP из `x-forwarded-for` (первое значение); ответ `429` с заголовком `Retry-After` и точным сроком в тексте |
| `lib/supabase/portalAuth.types.ts` | `retry_after` в `PortalLoginResult`, `p_ip` в аргументах RPC |

**Изменение поведения при отсутствии `SUPABASE_JWT_SECRET`.** Раньше
middleware обходился без него (секрет требовался только маршруту
`/api/auth/token`), и портал грузился, но не показывал данные. Теперь
`session.ts` импортирует `jwt.ts`, поэтому при незаданном секрете middleware
падает с понятной ошибкой на каждом запросе. Это по-прежнему fail-closed —
внутрь никто не попадает, — и диагностируется лучше прежнего молчаливого
цикла редиректов на `/login`. Но переменная стала обязательной для работы
портала целиком, а не для одного маршрута.

**Проверено руками после деплоя фазы 2 в production** — вход, неверный
пароль, срабатывание ограничения и рост `retry_after` (2→4→16 с), лимит
по источнику, а не по логину, другой источник не пострадал, сброс счётчика
успешным входом воспроизведён точным сценарием (3 неудачи → успех →
обычная 401, не 429). Полная таблица —
[`../ROLLOUT-login-rate-limit.md`](../ROLLOUT-login-rate-limit.md).
Не проверено: отключённая учётка, истёкшая/отозванная сессия отдельным
сценарием (сессии в целом работают, но именно эти два состояния не
воспроизводились специально) — не блокирует фазу 3, полноты ради стоит
пройти при следующей возможности.

### Фаза 3 — `20260802200000_login_rate_limit_revoke_anon.sql`

**Применена 2 августа 2026.** `revoke execute ... from anon` на всех трёх
функциях. Проверено `curl` до/после на каждой из трёх: анонимный вызов
теперь отвергается ошибкой прав (`42501 permission denied`), тогда как
вызов через приложение (роль `portal_auth_caller`) продолжает получать
обычный бизнес-ответ. Регрессий в лимите частоты и заголовках после смены
прав не обнаружено. Реальный вход под тестовой учёткой после применения
подтверждён отдельно. **C-3 и C-4 из `AUDIT-2026-07-31.md` закрыты.**

### Ретенция

**Настроена и подтверждена** 3 августа 2026. `pg_cron` не был включён в
проекте вовсе (`relation "cron.job" does not exist` при первой попытке
проверки) — включён через `create extension if not exists pg_cron;`,
затем заведено задание:

```sql
select cron.schedule('portal-purge-login-attempts', '0 * * * *',
                     $$ select public.portal_purge_login_attempts() $$);
```

Подтверждено `select * from cron.job`: `jobname = 'portal-purge-login-attempts'`,
`schedule = '0 * * * *'`, `active = true`. Без этого `portal_login_attempts`
росла бы неограниченно — эта часть C-3 тоже закрыта.
