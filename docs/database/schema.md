# База данных (Supabase / Postgres)

Схема описана по реальным миграциям в
[`../supabase/migrations/`](../../supabase/migrations/) и сгенерированным типам
[`../src/lib/supabase/database.types.ts`](../../src/lib/supabase/database.types.ts).
Секреты, реальный URL проекта и значения ключей сюда не записываются.

Источник истины — миграции. Если что-то не подтверждено миграцией или типами,
это явно отмечено ниже.

## Таблицы

Подтверждены восемнадцать таблиц в схеме `public`: `candidates`,
`candidate_list_options`, `staffing_demand`, `staffing_demand_rows`,
`staffing_demand_history`, `addresses`, `rate_cards`, `rates`, пять таблиц
раздела «Описание вакансии» (`vacancy_projects`, `vacancy_sections`,
`vacancy_fields`, `vacancy_attachments`, `vacancy_history` — TASK-010, **не
применены к боевой БД**, см. `migrations.md`), две таблицы импорта
потребности из Excel (`project_import_configs`, `staffing_demand_imports` —
**не применены к боевой БД**, см. `migrations.md`) и три таблицы встроенной
авторизации — `portal_users`, `portal_sessions`, `portal_audit_log`.

`addresses` (миграция `20260729130000_create_addresses.sql` + две последующие),
`rate_cards`/`rates` (миграции `20260731100000`…`20260731100300`, см.
[`migrations.md`](migrations.md)) и встроенная авторизация
(`20260728120000_portal_auth.sql`) применены к боевой БД, `database.types.ts`
регенерирован — все три отражены в нём.

Схема `auth` Supabase **больше не используется**: с июля 2026 портал ведёт
пользователей сам (см. [ADR-004](../architecture/decisions/ADR-004-portal-auth.md)).

### `public.candidates`

Кандидаты раздела «Кандидаты». Soft-delete через `archived_at`, физического
удаления нет.

| Поле | Тип | Null | Примечание |
|------|-----|------|-----------|
| `id` | uuid | not null | PK, `gen_random_uuid()` |
| `external_id` | text | nullable | Бизнес-ID, вводится вручную, **не уникален** |
| `full_name` | text | **not null** | ФИО одной строкой |
| `project` | text | **not null** | Свободный текст, подсказки — `candidate_list_options` (`list_type = project`). До `20260731120000_unify_project_free_text.sql` было enum `candidate_project` (12 жёстких значений) — переведено на общий с «Адресами»/«Потребностью»/«Ставками» управляемый список, расширяется в Настройках без миграции |
| `city` | text | nullable | |
| `position` | text | nullable | Должность. Свободный текст, подсказки — `candidate_list_options` (`list_type = position`) |
| `stage` | enum `candidate_stage` | nullable | NULL = стадия ещё не достигнута |
| `recruiter` | text | nullable | Свободный текст (подсказки — в справочниках) |
| `manager` | text | nullable | Свободный текст |
| `coordinator` | text | nullable | Свободный текст |
| `source` | text | nullable | |
| `phone` | text | nullable | Text (может содержать `+`, скобки, доб.), не уникален |
| `telegram_tag` | text | nullable | |
| `max_tag` | text | nullable | |
| `comment` | text | nullable | |
| `has_medical_book` | boolean | nullable | `true`=есть, `false`=нет, `null`=не указано |
| `salary_card` | text | nullable | Свободный текст, фикс. списка банков нет |
| `invitation_at` | timestamptz | nullable | |
| `registration_at` | timestamptz | nullable | |
| `first_shift_at` | timestamptz | nullable | Используется в метрике «Успешно вышли» |
| `created_at` | timestamptz | not null | `default now()` |
| `updated_at` | timestamptz | not null | `default now()`, обновляется триггером |
| `archived_at` | timestamptz | nullable | NULL = активный; заполнено = архивирован |

**Индексы:** по большинству фильтруемых полей (project, stage, city,
recruiter, manager, coordinator, датам, phone, telegram_tag, max_tag,
has_medical_book, created_at, archived_at) + GIN trigram-индекс по `full_name`
(`pg_trgm`) для поиска по части имени.

**Триггер:** `trg_candidates_set_updated_at` — ставит `updated_at = now()`
перед каждым `UPDATE`.

### `public.candidate_list_options`

Редактируемые списки-подсказки для свободнотекстовых полей кандидата
(recruiter/manager/coordinator/city/position). **Не ограничивает** значения в
`candidates.*` — только курирует подсказки в выпадающих списках.

Справочник **должностей** (`list_type = position`) общий для всех проектов:
любая должность может использоваться на любом проекте. Засеян 21 значением
(Курьер, Сборщик, Кладовщик, Кассир, Повар, Бариста, Уборщик, Экспедитор,
Контроллер-кассир, Продавец, Кухонный рабочий, Грузчик, Оператор кухни,
Оператор АЗС, Авто, Вело, Электровело, Пеший, Мото, Универсал, Вахта) —
список намеренно плоский, каким его задал бизнес. Пополняется и
включается/выключается в Настройках без миграции.

| Поле | Тип | Null | Примечание |
|------|-----|------|-----------|
| `id` | uuid | not null | PK, `gen_random_uuid()` |
| `list_type` | enum `candidate_list_type` | **not null** | Какому полю кандидата соответствует |
| `value` | text | **not null** | Значение-подсказка |
| `sort_order` | integer | not null | `default 0`, ручной порядок (↑/↓ в Настройках) |
| `is_active` | boolean | not null | `default true`; `false` = скрыт из подсказок, но остаётся в БД |
| `created_at` | timestamptz | not null | `default now()` |

**Ограничение:** `unique (list_type, value)` — в рамках одного типа значения
не повторяются. **Индексы:** по `list_type` и по `(list_type, sort_order)`.

### `public.staffing_demand`

Плановая потребность в персонале по проекту/городу/должности/дню для раздела
«Потребность». **Без soft-delete** (в отличие от остальных таблиц) —
очистка ячейки в UI физически удаляет строку, значение обновляется обычным
upsert.

| Поле | Тип | Null | Примечание |
|------|-----|------|-----------|
| `id` | uuid | not null | PK, `gen_random_uuid()` |
| `project` | text | **not null** | Свободный текст, тот же справочник `candidate_list_options` (`list_type = project`), что у кандидатов. До `20260731120000_unify_project_free_text.sql` было enum `candidate_project` |
| `city` | text | **not null** | Свободный текст, без FK на `candidate_list_options` |
| `position` | text | **not null** | Свободный текст, подсказки — `candidate_list_options` (`list_type = position`), тот же справочник, что и у `candidates.position` |
| `demand_date` | date | **not null** | |
| `planned_count` | integer | **not null** | `check (planned_count >= 0)`; отсутствие строки = «не задано» |
| `address` | text | nullable | С `20260805110000_add_demand_import_support.sql`. Заполняется импортом из Excel (`src/lib/imports/`); `NULL` = потребность не привязана к конкретному адресу — весь ручной ввод и вся матрица «Потребность» до этой миграции именно такие. `NULL` ≠ `''` (пустая строка означала бы «адрес указан, но пуст») |
| `source` | text | **not null** | `default 'manual'`; `check (source in ('manual', 'excel'))` — откуда взялась строка |
| `import_id` | uuid | nullable | FK → `staffing_demand_imports.id` (`on delete set null`). Заполнено только для строк, созданных/обновлённых импортом — используется для отмены последнего импорта |
| `created_at` | timestamptz | not null | `default now()` |
| `updated_at` | timestamptz | not null | `default now()`, обновляется триггером |

**Ограничение:** `unique (project, city, position, demand_date, address)`
(обычный, не partial — см. примечание ниже; расширен полем `address` в
`20260805110000_add_demand_import_support.sql`, до этого был
`unique (project, city, position, demand_date)`; Postgres не считает `NULL`
конфликтующим с `NULL` в unique-индексе, поэтому ручные строки — все с
`address is null` — остались взаимно уникальными по прежнему ключу без
миграции данных). **Индексы:** по `demand_date`, `project`, `city`,
`import_id`. Отдельного индекса по `position`/`address` нет — сам уникальный
констрейнт уже покрывает срезы `(project)`, `(project, city)` и
`(project, city, position)`, дублирующий индекс был бы избыточен.

**Триггер:** `trg_staffing_demand_set_updated_at` — переиспользует
`set_candidates_updated_at()` из миграции `candidates`.

**Почему без soft-delete:** запись потребности не несёт исторической/
аудиторской ценности после снятия значения, поэтому очистка ячейки — обычный
`DELETE`, а не `archived_at`. Это осознанное отличие от `candidates`/
`candidate_list_options`. Также именно поэтому здесь используется **обычный**
`unique`-констрейнт, а не partial unique index по `archived_at is null`:
связка Supabase-JS `.upsert(...).onConflict(...)` с partial index может вести
себя непредсказуемо через PostgREST, а с обычным индексом `onConflict:
"project,city,demand_date"` работает предсказуемо.

### `public.staffing_demand_rows`

Метаданные строки «проект+город+должность» в разделе «Потребность»: статус
и комментарий, **не привязанные к дате** — в отличие от `staffing_demand`,
где строка = проект+город+должность+дата. Запись создаётся только при
первом изменении статуса/комментария; её отсутствие в UI трактуется как
`status = active`, `comment = null`.

| Поле | Тип | Null | Примечание |
|------|-----|------|-----------|
| `id` | uuid | not null | PK, `gen_random_uuid()` |
| `project` | text | **not null** | Свободный текст, без FK и без обязательной связи со списком `candidate_list_options` — эта таблица независимый от других хранит статус/комментарий по паре «проект+город», её `project` не обязан совпадать буквально ни с чем (в отличие от `staffing_demand.project`, который с `20260731120000_unify_project_free_text.sql` берёт значения из общего списка) |
| `city` | text | **not null** | Свободный текст, без FK |
| `position` | text | **not null** | Свободный текст, без FK — определяет, к какой должности внутри города относится статус/комментарий |
| `status` | text | **not null** | `default 'active'`; `check (status in ('active','paused','closed'))` |
| `comment` | text | nullable | `check (comment is null or char_length(comment) <= 2000)`; приложение приводит `""` к `null` перед записью |
| `created_at` | timestamptz | not null | `default now()` |
| `updated_at` | timestamptz | not null | `default now()`, обновляется триггером |

**Ограничение:** `unique (project, city, position)` (расширен полем
`position`, до этого был `unique (project, city)`). **Индексы:** по
`project`, `city`, `status`. Отдельного индекса по `position` нет — тот же
принцип, что и в `staffing_demand`: уникальный констрейнт уже покрывает
нужные срезы.

**Триггер:** `trg_staffing_demand_rows_set_updated_at` — переиспользует
тот же `set_candidates_updated_at()`.

### `public.project_import_configs`

Какой парсер и какой маппинг колонок Excel использовать для проекта при
импорте потребности (`src/lib/imports/parsers/`). Смена формата файла
проекта — новая строка/новый `parser_key` здесь, без изменения кода.
Добавлена в `20260805110000_add_demand_import_support.sql`.

| Поле | Тип | Null | Примечание |
|------|-----|------|-----------|
| `id` | uuid | not null | PK, `gen_random_uuid()` |
| `project` | text | **not null** | Тот же свободный список, что `staffing_demand.project` |
| `parser_key` | text | **not null** | Ключ реализации `DemandParser` в `parserRegistry.ts` — не совпадает с `project` (проект может сменить парсер, оставшись тем же проектом) |
| `column_mapping` | jsonb | **not null** | Произвольный словарь "поле → заголовок колонки Excel". Форма зависит от парсера: для `genericColumnParser` — `{"city", "address", "position", "demand", "date"}`; для `parser_lavka.ts` — `{"task", "position", "demand", "date", "status"}` (см. комментарий в файле парсера) |
| `enabled` | boolean | not null | `default true` |
| `version` | integer | not null | `default 1` — записывается в историю импорта (`staffing_demand_imports.parser_version`) |
| `created_at` / `updated_at` | timestamptz | not null | `updated_at` обновляется триггером |

**Ограничение:** `unique (project, parser_key)`. Для проекта «Лавка»
реализован специализированный парсер (`lavka_v1`). Остальные проекты
(БК/Газпром/Купер) временно используют generic-парсер с одинаковым
маппингом колонок. После получения образцов Excel для каждого проекта будут
реализованы собственные `parser_*.ts` без изменения архитектуры импорта —
см. `docs/requirements/addresses.md`.

### `public.staffing_demand_imports`

Журнал загрузок потребности из Excel: кто, когда, каким парсером, сколько
строк обработано/импортировано/с ошибками, полный `error_log`/`warnings`.
Добавлена в `20260805110000_add_demand_import_support.sql`.

| Поле | Тип | Null | Примечание |
|------|-----|------|-----------|
| `id` | uuid | not null | PK, `gen_random_uuid()` |
| `created_at` | timestamptz | not null | `default now()` |
| `created_by` | uuid | nullable | FK → `portal_users.id` (`on delete set null`) |
| `created_by_login` | text | nullable | Снимок логина на момент импорта — переживает переименование/удаление учётки, как `portal_audit_log.actor_login` |
| `project` | text | **not null** | |
| `parser_key` / `parser_version` | text / integer | **not null** | Какой парсер и какой его версии использовался |
| `file_name` | text | **not null** | |
| `mode` | text | **not null** | `check (mode in ('replace', 'add'))` |
| `dry_run` | boolean | not null | `default false` — «Проверить» без записи в базу |
| `total_rows` / `imported_rows` / `error_rows` / `new_rows` / `updated_rows` | integer | not null | `default 0` |
| `status` | text | **not null** | `check (status in ('success', 'partial', 'failed', 'reverted'))` |
| `duration_ms` | integer | not null | `default 0` |
| `error_log` | jsonb | not null | `default '[]'`; массив `{rowNumber, reason}` |
| `warnings` | jsonb | not null | `default '[]'`; массив строк |

**Индексы:** по `created_at desc`, по `(project, created_at desc)`. Доступ
(`SELECT`/`INSERT`/`UPDATE`) — только head/coordinator (`portal_can('addresses')
and portal_can('settings')`), как у записи «Описания вакансии».

**Откат импорта:** удаляет из `staffing_demand` строки с этим `import_id` и
проставляет `status = 'reverted'` (`src/lib/imports/revertImport.ts`).
Безопасен без потери данных только для `mode = 'replace'` или импортов, не
обновивших ни одной существующей строки (`updated_rows = 0`) — см.
известные ограничения в `docs/requirements/addresses.md`.

**Почему `status` через `CHECK`, а не enum:** список статусов проще
расширить (добавить значение) без миграции типа `ALTER TYPE ... ADD
VALUE` — просто пересоздать/дополнить `CHECK`. Сужение до конкретных
трёх строковых значений на уровне TypeScript делает приложение
(`demandRowMeta.ts`), а не сгенерированные типы (там `status: string`).

**Не удаляется физически** — как и `candidate_list_options`, без
delete-политики: очистка комментария — это `UPDATE comment = null`, не
удаление строки; статус тоже меняется только через `UPDATE`.

### `public.staffing_demand_history`

Аудит изменений «Потребности»: количество (`staffing_demand`) и
статус/комментарий строки (`staffing_demand_rows`) — в одной общей таблице.
Пишется только `SECURITY DEFINER`-триггерами (`log_staffing_demand_change`,
`log_staffing_demand_rows_change`); клиент не может вставлять, менять или
удалять записи напрямую (RLS разрешает только `select`).

| Поле | Тип | Null | Примечание |
|------|-----|------|-----------|
| `id` | uuid | not null | PK, `gen_random_uuid()` |
| `staffing_demand_id` | uuid | nullable | id исходной строки `staffing_demand` на момент изменения, без FK — история переживает физическое удаление ячейки. `NULL` для записей о `staffing_demand_rows` |
| `project` | text | **not null** | |
| `city` | text | **not null** | |
| `position` | text | **not null** | Всегда заполнено (source-таблицы `position` тоже `NOT NULL`) |
| `demand_date` | date | nullable | **Заполнено** = запись о `staffing_demand` (количество на дату). `NULL` = запись о `staffing_demand_rows` (статус/комментарий, не привязаны к дате) — используется как различитель источника вместо отдельного поля |
| `old_quantity` / `new_quantity` | integer | nullable | Для записей о `staffing_demand` |
| `old_status` / `new_status` | text | nullable | Для записей о `staffing_demand_rows` |
| `old_comment` / `new_comment` | text | nullable | Для записей о `staffing_demand_rows` |
| `action` | enum `staffing_demand_history_action` | **not null** | `insert` / `update` / `delete` |
| `changed_by` | uuid | nullable | `auth.uid()` на момент изменения — подделать нельзя, пишет только `SECURITY DEFINER`-функция |
| `changed_at` | timestamptz | not null | `default now()` |

**Индексы:** `(project, city, demand_date, changed_at desc)` — история
конкретной ячейки; `(project, city, changed_at desc) where demand_date is
null` — история строки статуса/комментария (частичный индекс, до
добавления должности); `(project, city, position, changed_at desc)` —
основной запрос `DemandHistoryDrawer` после добавления должности (project +
city + position + свежие сверху).

**Не удаляется и не редактируется вручную** — только `insert` через
триггеры; для `authenticated` есть только `select`-политика.

**UI:** только действие «История изменений» в меню ячейки
(`DemandCellMenu` → `DemandHistoryDrawer`) читает эту таблицу, при
открытии, лениво, по конкретной ячейке (project+city+position+date).
Половина таблицы про `staffing_demand_rows` (статус/комментарий) пишется с
самого начала, но отдельного экрана истории для неё пока нет — осознанный
задел на будущее без изменения схемы.

### `public.addresses`

Объекты подбора («Адреса»): один объект (даркстор/магазин/склад/ПВЗ/
ресторан/…) = одна карточка — в отличие от `staffing_demand`, без матрицы по
датам. Soft-delete через `archived_at`, как `candidates`; в UI представлен
сегментированным переключателем «Активные/Архив», не отдельной страницей.

| Поле | Тип | Null | Примечание |
|------|-----|------|-----------|
| `id` | uuid | not null | PK, `gen_random_uuid()` |
| `project` | text | **not null** | Свободный текст, тот же справочник `candidate_list_options` (`list_type = project`), что у кандидатов/потребности. До `20260731120000_unify_project_free_text.sql` было enum `candidate_project` |
| `city` | text | **not null** | Подсказки — `candidate_list_options` (`city`) |
| `position` | text | nullable | Специализация/должность объекта. **Тот же справочник**, что `candidates.position`/`staffing_demand.position` (`candidate_list_options`, `list_type = position`) — намеренно назван `position`, а не `specialization`, чтобы не плодить второе имя одного понятия |
| `full_address` | text | **not null** | |
| `metro` / `district` | text | nullable | Без FK; варианты фильтра в UI строятся из уже загруженных данных, отдельного справочника нет |
| `latitude` / `longitude` | numeric | nullable | Раздельные числовые поля (не одна строка), чтобы карта/маршруты/поиск ближайших объектов не требовали миграции |
| `object_type` | text | **not null** | `default 'other'`; `check in (darkstore, shop, warehouse, pvz, restaurant, production, office, other)` |
| `required_count` / `staffed_count` / `planned_start_count` / `in_progress_count` | integer | **not null** | `default 0`, `check (>= 0)`. Требуется / Есть сотрудников / План выхода / В работе |
| `status` | text | **not null** | `default 'unrestricted'`; `check in (stop, reserve, hiring_standby, any_candidate, unrestricted)` |
| `priority` | smallint | **not null** | `default 3`; `check between 1 and 5` (5 = критический … 1 = минимальный) |
| `schedule_type` | text | nullable | `check in ('2/2','3/3','5/2','6/1','7/0','flexible','parttime')` |
| `shift_type` | text | nullable | `check in ('day','night','mixed')` |
| `shift_times` | text[] | **not null** | `default '{}'`; несколько времён выхода, например `{'08:00','14:00'}` |
| `payment_type` | text | nullable | `check in ('hourly','per_shift','per_order')` |
| `payment_amount` | numeric | nullable | `check (>= 0)` |
| `coordinator_name` | text | nullable | Подсказки — `candidate_list_options` (`coordinator`) |
| `coordinator_phone` / `coordinator_telegram` | text | nullable | |
| `site_manager_name` / `site_manager_phone` | text | nullable | Свободный текст — сознательно **не** тот же справочник, что `candidates.manager` (это другая роль: руководитель физического объекта, а не рекрутинговый менеджер) |
| `coordinator_comment` | text | nullable | `check (char_length <= 4000)` |
| `features` | text[] | **not null** | `default '{}'`; слаги чекбоксов «Особенности объекта», подписи только в `addressOptions.ts` |
| `document_links` | jsonb | **not null** | `default '[]'`; массив `{id, title, url, type}` — **только внешние ссылки**, в проекте нет Supabase Storage (см. `requirements/addresses.md`). `check (addresses_document_links_valid(document_links))` — форма массива и `url` только `http`/`https` (находка H-3, миграция `20260803120000`) |
| `archived_at` | timestamptz | nullable | NULL = активен; заполнено = архивирован (soft delete) |
| `created_at` / `updated_at` | timestamptz | not null | `default now()`, поддерживаются триггером `set_addresses_audit_fields()` |
| `created_by` / `updated_by` | uuid | nullable | `references portal_users(id) on delete set null` — **первый случай FK из таблицы данных на `portal_users`**; проставляется тем же триггером из `auth.uid()` |
| `created_by_login` / `updated_by_login` | text | nullable | Текстовый снимок логина на момент записи (как `portal_audit_log.actor_login`) — `portal_users` закрыта RLS, `join` из клиента не сработает |

**Индексы:** по `project`, `city`, `position`, `status`, `priority`,
`object_type`, `district`, `metro`, `archived_at`; GIN trigram по
`full_address` для поиска (расширение `pg_trgm` уже включено миграцией
`candidates`).

**Триггер:** `trg_addresses_set_audit_fields` — своя функция
`set_addresses_audit_fields()` (`security definer`, читает `portal_users` по
`auth.uid()` для снимка логина), а не переиспользование
`set_candidates_updated_at()`: ей дополнительно нужно проставлять
`created_by`/`updated_by`(`_login`).

**Дефицит, % укомплектованности, «незакрытая потребность» — не колонки.**
Считаются в TS из `required_count`/`staffed_count` (`addressMetrics.ts`):
`Дефицит = Требуется − Есть`; при `Требуется = 0` укомплектованность — явно
`100%` (осознанное исключение из общего правила «пусто/0 → 0%» для этого
раздела).

**Известное ограничение:** полноценная история изменений по каждому полю (с
триггерами аудита, как у `staffing_demand_history`) в этой версии **не
сделана** — только снимок «кто/когда создал/изменил» в самой строке
(`created_by*`/`updated_by*` выше). Следующая задача.

### `public.rate_cards`

Блок условий раздела «Ставки»: проект + город + юр. лицо. Зарплатные
проекты, бонусы, акции, надбавки, условия оформления, менеджер, работа
офиса — хранятся **один раз на блок** и общие для всех его ставок
(`public.rates`). Структура снята с рабочей таблицы «ВКР Потребность.xlsx»,
где эти же условия заданы объединёнными ячейками на группу строк.

| Поле | Тип | Null | Примечание |
|------|-----|------|-----------|
| `id` | uuid | not null | PK, `gen_random_uuid()` |
| `project` | text | **not null** | Свободный текст, подсказки — `candidate_list_options` (`list_type = project`) — тот же общий список, что с `20260731120000_unify_project_free_text.sql` использует и `candidates`/`staffing_demand`/`addresses` |
| `city` | text | **not null** | Подсказки — `candidate_list_options` (`city`), тот же справочник, что у остальных разделов |
| `legal_entity` | text | **not null** | `default ''`; пустая строка = не указано. Не NULL, потому что поле входит в `unique (project, city, legal_entity)`, а NULL с NULL в уникальном индексе не конфликтует |
| `payroll_banks` | text[] | **not null** | `default '{}'`; слаги банков зарплатного проекта, подписи только в `rateOptions.ts` |
| `bonuses` / `promotions` / `surcharges` / `hiring_conditions` / `notes` | text | nullable | `check (char_length <= 4000)` на каждом |
| `manager` | text | nullable | Подсказки — `candidate_list_options` (`manager`) |
| `office_status` | text | **not null** | `default 'unknown'`; `check in ('working','not_working','unknown')` |
| `created_at` / `updated_at` | timestamptz | not null | `default now()`, поддерживаются триггером `set_rates_audit_fields()` |
| `created_by` / `updated_by` | uuid | nullable | `references portal_users(id) on delete set null` |
| `created_by_login` / `updated_by_login` | text | nullable | Текстовый снимок логина на момент записи — `portal_users` закрыта RLS, `join` из клиента не сработает |

**Ограничение:** `unique (project, city, legal_entity)`. **Индексы:** по
`project`, `city`, `legal_entity`, `manager`, `office_status`.

**Триггер:** `trg_rate_cards_set_audit_fields` — своя функция
`set_rates_audit_fields()` (`security definer`, та же логика, что
`set_addresses_audit_fields()`), общая с `public.rates`.

### `public.rates`

Строка тарифа раздела «Ставки»: должность внутри блока `public.rate_cards`.
Связь — настоящий внешний ключ с каскадом (`rate_card_id ... on delete
cascade`), а не естественный ключ без FK, как у `staffing_demand_rows`:
переименование города в блоке не должно отцеплять от него строки, а
удаление блока не должно оставлять сирот.

| Поле | Тип | Null | Примечание |
|------|-----|------|-----------|
| `id` | uuid | not null | PK, `gen_random_uuid()` |
| `rate_card_id` | uuid | **not null** | FK → `rate_cards(id)`, **`on delete cascade`** |
| `position` | text | **not null** | Свободный текст, подсказки — `candidate_list_options` (`position`), тот же справочник, что у «Потребности»/«Кандидатов»/«Адресов» |
| `unit` | text | **not null** | `default 'hour'`; `check in ('hour','hour_order','hour_item','order','stop','shift','day','route')` |
| `rate_hour` / `rate_hour_priority` | numeric | nullable | `check (>= 0)`. Основная/приоритетная ставки за час — в Excel это одна колонка вида «235/255» |
| `rate_piece` | numeric | nullable | `check (>= 0)`; ставка за единицу — что считать единицей, задаёт `unit` |
| `pieces_per_shift` | numeric | nullable | `check (>= 0)`; единиц за смену |
| `rate_shift` | numeric | nullable | `check (>= 0)`; фиксированная оплата за смену/сутки/маршрут |
| `shift_hours` | numeric | **not null** | `default 12`; `check (> 0 and <= 24)` |
| `surcharge_per_shift` | numeric | nullable | `check (>= 0)`; средняя сумма надбавок за смену — вводимое значение, не расчёт |
| `schedule` | text | nullable | `check in ('2/2','3/3','5/2','6/1','7/0','flexible','parttime')` — тот же набор значений, что `addresses.schedule_type`, но отдельное поле |
| `extras` | jsonb | **not null** | `default '[]'`; массив `{id, label, value}` — показатели, специфичные для отдельных клиентов (SLA-стопы, доплата за вес, топливная карта…) |
| `comment` | text | nullable | `check (char_length <= 4000)` |
| `sort_order` | integer | **not null** | `default 0`; порядок должностей внутри блока |
| `created_at` / `updated_at` | timestamptz | not null | `default now()`, поддерживаются триггером `set_rates_audit_fields()` |
| `created_by` / `updated_by` | uuid | nullable | `references portal_users(id) on delete set null` |
| `created_by_login` / `updated_by_login` | text | nullable | Как у `rate_cards` |

**Ограничение:** `unique (rate_card_id, position)`. **Индексы:** по
`rate_card_id`, `position`, `unit`; GIN trigram по `position` для поиска
(расширение `pg_trgm` уже включено миграцией `candidates`).

**Триггер:** `trg_rates_set_audit_fields` — та же функция
`set_rates_audit_fields()`, что у `rate_cards`.

**Доход за смену/неделю/месяц — не колонки.** Считаются в TS из тарифных
полей и графика (`rateMetrics.ts`): `за смену = ставка_за_час × часов +
ставка_за_единицу × единиц + фиксированная_оплата + средняя_надбавка`;
неделя/месяц — то же × среднее число смен для графика (модель усреднённая,
не воспроизводит индивидуальные множители исходной таблицы Excel — см.
`requirements/rates.md`). Для `flexible`/`parttime` неделя/месяц не
считаются вовсе (`null`, не `0`).

**Удаляется физически** (не soft-delete) — как `staffing_demand`, у
«Ставок» нет исторической ценности в устаревшем тарифе.

### `public.vacancy_projects`, `vacancy_sections`, `vacancy_fields`, `vacancy_attachments`, `vacancy_history`

**TASK-010, не применены к боевой БД** — написаны, не выкатывались, см.
`migrations.md`. Корень раздела «Описание вакансии» вместе с четырьмя
дочерними таблицами — полная замена статического `src/lib/portal/vacancyData.ts`
(удалён) реальными, редактируемыми данными.

`public.vacancy_projects`:

| Поле | Тип | Null | Примечание |
|------|-----|------|-----------|
| `id` | uuid | not null | PK. Используется как ключ выбора вместо `slug` — отдельного слага нет, он был нужен только старому статическому файлу |
| `title` | text | **not null** | Название вакансии |
| `category_option_id` | uuid | nullable | FK → `candidate_list_options(id)`, `on delete set null`. **Настоящий FK**, в отличие от `project`/`city`/`position` в остальных разделах (свободный текст с подсказкой) — справочники никогда не удаляются физически, только деактивируются, поэтому FK безопасен |
| `version` | integer | not null | `default 1`. Оптимистическая блокировка — см. `portal_save_vacancy_project_tree` |
| `archived_at` | timestamptz | nullable | NULL = активна; заполнено = архивирована (soft delete, как `addresses`) |
| `created_at`/`updated_at` | timestamptz | not null | `default now()`, триггер `set_vacancy_projects_audit_fields()` |
| `created_by`/`updated_by`(`_login`) | uuid/text | nullable | Снимок «кто/когда», как у `addresses`/`rate_cards` |

Профиль/регион/период/должность в Битрикс/ссылка на описание и т.п. — **не
колонки**: обычные поля внутри системного раздела «Общая информация»
(`vacancy_sections.is_system = true`, создаётся один раз при создании
вакансии с полями-затравками из `vacancyOptions.ts`). Один механизм
редактирования и для системных, и для произвольных полей.

`public.vacancy_sections` — разделы вакансии, полностью произвольные (без
фиксированного набора/`template`/enum):

| Поле | Тип | Null | Примечание |
|------|-----|------|-----------|
| `id` | uuid | not null | PK |
| `vacancy_project_id` | uuid | **not null** | FK → `vacancy_projects(id)`, `on delete cascade` |
| `title` | text | **not null** | Название раздела — свободно редактируется, даже у системного |
| `icon` | text | nullable | `IconName` по выбору автора раздела — косметика, ни на что не влияет |
| `is_system` | boolean | not null | `default false`. `true` только у автосозданной «Общая информация» — единственный функциональный флаг: такой раздел нельзя удалить/увести с первого места (проверяется в `portal_save_vacancy_project_tree`, не CHECK-ограничением) |
| `sort_order` | integer | not null | `default 0`, ручной порядок (↑/↓ в редакторе — drag-and-drop в проекте нет) |
| `archived_at` | timestamptz | nullable | Архив **одного раздела**, независимо от архива всей вакансии |
| `created_at`/`updated_at` | timestamptz | not null | `default now()`, триггер `set_candidates_updated_at()` (переиспользован) |

`public.vacancy_fields` — пары «подпись → значение» внутри раздела:

| Поле | Тип | Null | Примечание |
|------|-----|------|-----------|
| `id` | uuid | not null | PK |
| `section_id` | uuid | **not null** | FK → `vacancy_sections(id)`, `on delete cascade` |
| `label`/`value` | text | not null | `default ''` у обоих |
| `field_type` | text | not null | `default 'text'`; `check in ('text','textarea','rich_text','link','number','date','checkbox','select')` — набор с заделом на будущее, редакторы построены для всех, кроме `select` (нужен отдельный источник вариантов) |
| `sort_order` | integer | not null | `default 0`, ручной порядок |
| `created_at`/`updated_at` | timestamptz | not null | `default now()`, триггер `set_candidates_updated_at()` |

`public.vacancy_attachments` — внешние ссылки (PDF/Google Docs/видео/ссылка;
Supabase Storage в проекте нет):

| Поле | Тип | Null | Примечание |
|------|-----|------|-----------|
| `id` | uuid | not null | PK |
| `vacancy_project_id` | uuid | **not null** | FK → `vacancy_projects(id)`, `on delete cascade` |
| `section_id` | uuid | nullable | FK → `vacancy_sections(id)`, `on delete set null` — вложение можно привязать к разделу (показывается в его карточке) или оставить общим (`null`, общий блок «Вложения»); при удалении раздела вложение **не удаляется**, откатывается к общим |
| `title` | text | not null | |
| `url` | text | not null | `check (url ~ '^https?://')` |
| `type` | text | not null | `default 'link'`; `check in ('pdf','google_doc','video','link')` |
| `sort_order` | integer | not null | `default 0` |
| `created_at` | timestamptz | not null | `default now()` |

`public.vacancy_history` — аудит на уровне поля/раздела/вложения/проекта,
пишется только `SECURITY DEFINER`-триггерами (`log_vacancy_*_change`),
хранит `to_jsonb(old)`/`to_jsonb(new)` целиком (проще и надёжнее
построчного диффа на четырёх разных по форме таблицах-источниках), не
построчный diff-viewer — только «кто/когда/что» на карточку «История»:

| Поле | Тип | Null | Примечание |
|------|-----|------|-----------|
| `id` | uuid | not null | PK |
| `vacancy_project_id` | uuid | **not null** | FK → `vacancy_projects(id)`, `on delete cascade` — в отличие от `staffing_demand_history`, здесь безопасно: вакансия никогда не удаляется физически, только архивируется |
| `entity_type` | text | not null | `check in ('project','section','field','attachment')` |
| `entity_id` | uuid | not null | Без FK — переживает удаление строки-источника |
| `action` | text | not null | `check in ('insert','update','delete')` |
| `old_data`/`new_data` | jsonb | nullable | Снимок всей строки |
| `changed_by`(`_login`) | uuid/text | nullable | Как у `addresses`/`rate_cards` |
| `changed_at` | timestamptz | not null | `default now()` |

**Атомарность записи через RPC, не последовательные запросы.** В отличие от
`rate_cards`/`rates` (клиент делает несколько отдельных вызовов подряд),
сохранение всего дерева вакансии идёт через одну `SECURITY DEFINER`-функцию
`public.portal_save_vacancy_project_tree(project_id, expected_version,
payload)` — одна транзакция на insert/update/delete всех
разделов/полей/вложений сразу, с проверкой `version` (оптимистическая
блокировка: конфликт, если кто-то другой уже сохранил вакансию раньше) и
прав (`portal_can('vacancies') and portal_can('settings')`) внутри самой
функции. `public.portal_duplicate_vacancy_project(project_id)` копирует
дерево целиком тем же способом. `public.search_vacancy_projects(query)` —
substring-поиск id вакансий по названию проекта/раздела/подписи или
значения поля (без ранжирования по релевантности).

### `public.portal_users`

Учётные записи портала. Создаются только через интерфейс («Настройки →
Команда и роли»), **физически не удаляются** — только деактивируются.

| Поле | Тип | Null | Примечание |
|------|-----|------|-----------|
| `id` | uuid | not null | PK, `gen_random_uuid()` |
| `full_name` | text | **not null** | `check` длины 2–120 после `btrim` |
| `login` | text | **not null** | Уникален. `check (login ~ '^[a-z0-9._-]{3,32}$')` — хранится только в нижнем регистре, поэтому уникального индекса по самому полю достаточно |
| `password_hash` | text | **not null** | bcrypt (`pgcrypto`: `crypt`/`gen_salt('bf', 10)`). Открытый пароль не хранится и не возвращается ни одной функцией |
| `role` | enum `portal_user_role` | **not null** | head / coordinator / manager / recruiter |
| `projects` | text[] | **not null** | Значения проектов как текст, без FK. `check (cardinality(projects) > 0)` |
| `is_active` | boolean | not null | `default true`; `false` = вход запрещён |
| `created_at` | timestamptz | not null | `default now()` |
| `updated_at` | timestamptz | not null | `default now()`, триггер `set_candidates_updated_at()` |
| `last_login_at` | timestamptz | nullable | Обновляется при успешном входе |

**Индексы:** `unique (login)`, по `is_active`.

**Почему `projects` — массив текста, а не FK:** список проектов ведётся
через `candidate_list_options` (`list_type = project`) и может расширяться
независимо от учёток, из Настроек, без миграции; привязка через FK
потребовала бы отдельной таблицы проектов, которой нет.

С H-6 (миграция `20260803140000_project_scoped_rls_policies.sql`) это поле
**фильтрует доступ к данным** через `portal_has_project()` — но только для
ролей `coordinator`/`manager`/`recruiter`. Для роли **`head` поле остаётся
информационным**: `portal_has_project()` для неё всегда возвращает `true`
независимо от содержимого `projects` (сознательное архитектурное решение —
см. `docs/ROLLOUT-project-access.md`). При заведении первого сотрудника
не-`head` роли важно назначить ей правильные проекты сразу — иначе она
увидит ноль данных ни в одном проектном разделе.

### `public.portal_sessions`

Активные сессии. В базе лежит **sha256 от токена**, а не сам токен: дамп
таблицы не даёт войти.

| Поле | Тип | Null | Примечание |
|------|-----|------|-----------|
| `id` | uuid | not null | PK. Попадает в JWT как claim `sid` |
| `user_id` | uuid | **not null** | FK → `portal_users(id)`, `on delete cascade` |
| `token_hash` | text | **not null** | Уникален. `encode(digest(token,'sha256'),'hex')` |
| `user_agent` | text | nullable | Первые 400 символов |
| `created_at` | timestamptz | not null | `default now()` |
| `last_seen_at` | timestamptz | not null | Обновляется не чаще раза в 5 минут |
| `expires_at` | timestamptz | **not null** | Скользящие 12 часов от последней активности |
| `revoked_at` | timestamptz | nullable | Заполнено = сессия закрыта (выход, деактивация, смена пароля) |

**Индексы:** `(user_id) where revoked_at is null`, по `expires_at`.

**Чего нет:** автоматической очистки истёкших сессий. Строки накапливаются;
при заметном росте понадобится плановое удаление — в бэклоге.

### `public.portal_audit_log`

Журнал действий администратора и событий входа. Пишется только
`SECURITY DEFINER`-функциями.

| Поле | Тип | Null | Примечание |
|------|-----|------|-----------|
| `id` | uuid | not null | PK |
| `action` | enum `portal_audit_action` | **not null** | 9 значений, см. ниже |
| `actor_id` | uuid | nullable | FK → `portal_users(id)`, `on delete set null` |
| `actor_login` | text | nullable | Снимок логина на момент события |
| `target_id` | uuid | nullable | FK → `portal_users(id)`, `on delete set null` |
| `target_login` | text | nullable | Снимок логина |
| `details` | jsonb | not null | `default '{}'`. **Паролей здесь не бывает** — только факт смены |
| `created_at` | timestamptz | not null | `default now()` |

**Индексы:** `(created_at desc)`, `(target_id, created_at desc)`,
частичный `(created_at desc) where action = 'login_failed'` — по нему
считается лимит попыток входа.

**Почему логины дублируются текстом:** запись должна оставаться читаемой
после переименования или обнуления связанной учётки. Это тот же приём, что и
`staffing_demand_id` без FK в истории «Потребности».

## Enum-типы

| Enum | Значения |
|------|----------|
| `candidate_stage` | Прибыл на проект, Отработал 1 смену, Отработал 10 смен, Завершил вахту (4) |
| `candidate_list_type` | recruiter, manager, coordinator, city, position, project, legal_entity, vacancy_category (8) |
| `staffing_demand_history_action` | insert, update, delete (3) |
| `portal_user_role` | head, coordinator, manager, recruiter (4) |
| `portal_audit_action` | user_created, user_updated, user_role_changed, user_password_changed, user_activated, user_deactivated, login_success, login_failed, logout (9) |

Роли хранятся латинскими слагами; русские подписи («Руководитель»,
«Координатор», «Менеджер», «Рекрутер») живут в `src/lib/auth/roles.ts`.

Значения стадий заданы бизнесом дословно и не переименовываются. Изменение
состава enum — это миграция схемы, а не правка справочника.

**`candidate_project`** (Самокат, Купер, ДонатсКофе, Яндекс Лавка, Яндекс РБ,
Газпромнефть, Евроторг, Мастер Деливери, Мастер Деливери Таксопарк, Азбука
вкуса, Бургер кинг Россия, Далли — 12 значений) в схеме ещё **определён**, но
с `20260731120000_unify_project_free_text.sql` **не используется** ни одной
колонкой: `candidates.project`, `staffing_demand.project`,
`addresses.project` переведены на свободный текст с общим управляемым
списком `candidate_list_options` (`list_type = project`) — тем же, что уже
использовали «Ставки». Тип не удалён: на него по имени ссылается
`portal_bootstrap_admin()` (см. `migrations.md`), а удаление добавило бы
риск без пользы. Список проектов теперь один на весь портал и расширяется в
Настройках без миграции.

## Архивирование и обновление

- **Кандидаты не удаляются физически** — архивируются через
  `archived_at = now()` и восстанавливаются через `archived_at = null`
  (см. `candidatesRepo.archiveCandidate` / `restoreCandidate`).
- **Справочники не удаляются физически** — деактивируются через
  `is_active = false`. `DELETE`-политика была намеренно удалена в последней
  миграции; функции hard-delete в репозитории нет.
- **Потребность (`staffing_demand`) удаляется физически** — это единственное
  исключение из общего правила soft-delete, см. раздел таблицы выше.
- **Адреса (`addresses`) не удаляются физически** — soft-delete через
  `archived_at`, как `candidates`.
- **Ставки (`rate_cards`/`rates`) удаляются физически** — как
  `staffing_demand`, без исторической ценности в устаревшем тарифе.
  Удаление `rate_cards` каскадом удаляет и все `rates` этого блока.
- **Вакансия (`vacancy_projects`) не удаляется физически** — soft-delete
  через `archived_at`, как `addresses`. Раздел/поле/вложение внутри неё
  (`vacancy_sections`/`vacancy_fields`/`vacancy_attachments`) удаляются
  физически (реальный `DELETE` через `portal_save_vacancy_project_tree`),
  их история переживает удаление в `vacancy_history`.
- **Метаданные строки (`staffing_demand_rows`) не удаляются вовсе** —
  только `UPDATE` статуса/комментария, delete-политики нет.
- **История (`staffing_demand_history`) только пишется** — `insert`
  через `SECURITY DEFINER`-триггеры, ни `update`, ни `delete` для
  `authenticated` не разрешены; строки неизменны после записи.
- `updated_at` в `candidates`, `staffing_demand` и `staffing_demand_rows`
  поддерживается триггером автоматически.

## Репозитории (data-слой)

- [`candidatesRepo.ts`](../../src/lib/supabase/candidatesRepo.ts): `listCandidates`,
  `createCandidate`, `updateCandidate`, `archiveCandidate`, `restoreCandidate`.
- [`candidateListOptionsRepo.ts`](../../src/lib/supabase/candidateListOptionsRepo.ts):
  `listCandidateListOptions`, `createCandidateListOption`,
  `updateCandidateListOption` (переименование / `is_active` / `sort_order`).
  Функции hard-delete нет намеренно.
- [`staffingDemandRepo.ts`](../../src/lib/supabase/staffingDemandRepo.ts):
  `listStaffingDemand`, `upsertStaffingDemandCell`, `deleteStaffingDemandCell`,
  `bulkUpsertStaffingDemand` — все, кроме `listStaffingDemand`, принимают
  `position` (upsert по `onConflict: "project,city,position,demand_date"`).
- [`staffingDemandRowsRepo.ts`](../../src/lib/supabase/staffingDemandRowsRepo.ts):
  `listStaffingDemandRowsMeta`, `upsertStaffingDemandRowMeta` (принимает
  `position`, upsert по `onConflict: "project,city,position"`). Функции
  удаления нет — не требуется.
- [`staffingDemandHistoryRepo.ts`](../../src/lib/supabase/staffingDemandHistoryRepo.ts):
  `listStaffingDemandCellHistory(project, city, position, demandDate)` —
  только чтение, вызывается лениво при открытии `DemandHistoryDrawer`.
- [`portalUsersRepo.ts`](../../src/lib/supabase/portalUsersRepo.ts):
  `listPortalUsers`, `isPortalLoginAvailable`, `createPortalUser`,
  `updatePortalUser`, `setPortalUserActive`, `setPortalUserPassword`,
  `listPortalAudit`. Работает не с таблицей, а с `portal_admin_*`
  функциями — сами таблицы закрыты RLS полностью. Функции удаления нет
  намеренно.
- [`addressesRepo.ts`](../../src/lib/supabase/addressesRepo.ts):
  `listAddresses`, `createAddress`, `updateAddress`, `archiveAddress`,
  `restoreAddress` (обёртка над `updateAddress` с `archived_at`, как
  `candidatesRepo`). Дублирование адреса — не отдельная функция репозитория,
  а логика в `PortalContext.duplicateAddressRecord`.
- [`ratesRepo.ts`](../../src/lib/supabase/ratesRepo.ts): `listRateCards`,
  `listRates`, `findOrCreateRateCard` (race-safe `upsert` с
  `ignoreDuplicates` по `unique (project, city, legal_entity)`, затем
  чтение по естественному ключу), `updateRateCard`, `deleteRateCard`,
  `createRate`, `updateRate`, `deleteRate`. Единственный репозиторий, где
  есть настоящая функция удаления (не soft-delete-обёртка).
- [`vacancyProjectsRepo.ts`](../../src/lib/supabase/vacancyProjectsRepo.ts)
  (TASK-010, не применена миграция — см. `migrations.md`): `listVacancyProjects`,
  `getVacancyProjectTree`, `createVacancyProject` (проект + системный раздел
  «Общая информация» с полями-затравками), `archiveVacancyProject`/
  `restoreVacancyProject` (прямой `update`, без RPC — дерево не трогает),
  `saveVacancyProjectTree`/`duplicateVacancyProject`/`searchVacancyProjects`
  — вызывают `portal_save_vacancy_project_tree`/`portal_duplicate_vacancy_project`/
  `search_vacancy_projects` через `supabase.rpc(...)`, а не последовательные
  REST-запросы (см. описание таблиц выше).
- [`vacancyHistoryRepo.ts`](../../src/lib/supabase/vacancyHistoryRepo.ts):
  `listVacancyProjectHistory(projectId)` — только чтение, лениво при
  открытии панели «История».

Типы: [`candidates.types.ts`](../../src/lib/supabase/candidates.types.ts),
[`candidateListOptions.types.ts`](../../src/lib/supabase/candidateListOptions.types.ts),
[`staffingDemand.types.ts`](../../src/lib/supabase/staffingDemand.types.ts),
[`staffingDemandRows.types.ts`](../../src/lib/supabase/staffingDemandRows.types.ts),
[`staffingDemandHistory.types.ts`](../../src/lib/supabase/staffingDemandHistory.types.ts),
[`rates.types.ts`](../../src/lib/supabase/rates.types.ts)
— выведены из `database.types.ts` (`Row`/`Insert`/`Update`/`Enums`), кроме
поля `rates.extras` (в сгенерированном типе `Json`, приложение
переопределяет его до `{id, label, value}[]` — тот же приём, что
`addresses.document_links`).

[`portalAuth.types.ts`](../../src/lib/supabase/portalAuth.types.ts) — всё ещё
**написан руками**, хотя `20260728120000` уже применена и `portal_users`/
`portal_sessions`/`portal_audit_log`/RPC-функции `portal_*` теперь отражены в
`database.types.ts`: этот файл описывает не таблицы (они закрыты RLS
полностью), а типизированный клиент RPC (`createPortalAuthClient()`), и
сведение его к выводу из `Database` — отдельная, не входящая в TASK-005
задача (см. `docs/tasks/backlog.md`).

[`addresses.types.ts`](../../src/lib/supabase/addresses.types.ts) — миграция
`20260729130000` применена, `database.types.ts` регенерирован: `AddressRow`/
`AddressInsert`/`AddressUpdate` теперь выведены из `Database`, как у соседей
(`candidates.types.ts` и т. д.), кроме поля `document_links` — оно в
сгенерированном типе `Json` (jsonb типизируется широко), а приложение всегда
хранит там конкретную форму `{id, title, url, type}[]`, поэтому это одно
поле переопределено поверх сгенерированного. Временные `AddressesDatabase`/
`createAddressesClient()` удалены — `addressesRepo.ts` использует общий
`createClient()`.

[`vacancyProjects.types.ts`](../../src/lib/supabase/vacancyProjects.types.ts) —
выведен из `Database`, как остальные (кроме `field_type`/`type` — text+CHECK,
сужены до литеральных union на уровне приложения). **Миграции TASK-010 не
применены и `database.types.ts` не регенерирован** — до этого момента типы
в файле не проверяются компилятором (см. комментарий в начале файла); это
ожидаемо, не баг, зафиксировано в `docs/tasks/TASK-010-vacancy-projects.md`.

## Переменные окружения

В `.env.local` (в репозиторий не коммитятся, покрыто `.gitignore` через `.env*`):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_JWT_SECRET` — **серверная**, без префикса `NEXT_PUBLIC_`. Секрет
  подписи JWT проекта (Dashboard → Project Settings → API → JWT Settings).
  Им портал подписывает короткоживущие токены доступа к данным, см.
  [`ADR-004`](../architecture/decisions/ADR-004-portal-auth.md)

Читаются только через статический `process.env.X` в
[`env.ts`](../../src/lib/supabase/env.ts) (динамический `process.env[name]` не
инлайнится Turbopack в клиентский бандл). Реальные значения в документацию не
записываются. На Vercel эти же переменные заданы в настройках проекта.

## Безопасность (RLS)

Вынесено в отдельный документ — [`policies.md`](policies.md): состав политик
по таблицам, модель доступа, известные ограничения.

## Миграции

Правила изменения схемы, порядок применения и полный список миграций —
[`migrations.md`](migrations.md).

## Генерируемые файлы

- `src/lib/supabase/database.types.ts` — из `supabase gen types typescript`.

`src/lib/portal/vacancyData.ts` (был здесь как генерируемый из Excel файл)
**удалён вместе со старым статическим разделом «Описание вакансии»** —
TASK-010 перевёл раздел на реальные данные Supabase. Excel теперь только
разовый источник переноса (`scripts/import-vacancy-data.mjs`), не
постоянный генератор.
