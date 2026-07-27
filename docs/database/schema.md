# База данных (Supabase / Postgres)

Схема описана по реальным миграциям в
[`../supabase/migrations/`](../../supabase/migrations/) и сгенерированным типам
[`../src/lib/supabase/database.types.ts`](../../src/lib/supabase/database.types.ts).
Секреты, реальный URL проекта и значения ключей сюда не записываются.

Источник истины — миграции. Если что-то не подтверждено миграцией или типами,
это явно отмечено ниже.

## Таблицы

Подтверждены пять таблиц в схеме `public`: `candidates`,
`candidate_list_options`, `staffing_demand`, `staffing_demand_rows` и
`staffing_demand_history`. Auth-таблицы (`auth.users` и т.п.) управляются
Supabase и в миграциях проекта не описаны.

### `public.candidates`

Кандидаты раздела «Кандидаты». Soft-delete через `archived_at`, физического
удаления нет.

| Поле | Тип | Null | Примечание |
|------|-----|------|-----------|
| `id` | uuid | not null | PK, `gen_random_uuid()` |
| `external_id` | text | nullable | Бизнес-ID, вводится вручную, **не уникален** |
| `full_name` | text | **not null** | ФИО одной строкой |
| `project` | enum `candidate_project` | **not null** | Ограничен перечислением |
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
| `project` | enum `candidate_project` | **not null** | Тот же enum, что и у кандидатов |
| `city` | text | **not null** | Свободный текст, без FK на `candidate_list_options` |
| `position` | text | **not null** | Свободный текст, подсказки — `candidate_list_options` (`list_type = position`), тот же справочник, что и у `candidates.position` |
| `demand_date` | date | **not null** | |
| `planned_count` | integer | **not null** | `check (planned_count >= 0)`; отсутствие строки = «не задано» |
| `created_at` | timestamptz | not null | `default now()` |
| `updated_at` | timestamptz | not null | `default now()`, обновляется триггером |

**Ограничение:** `unique (project, city, position, demand_date)` (обычный,
не partial — см. примечание ниже; расширен полем `position`, до этого был
`unique (project, city, demand_date)`). **Индексы:** по `demand_date`,
`project`, `city`. Отдельного индекса по `position` нет — сам уникальный
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
| `project` | text | **not null** | Свободный текст — здесь **не** enum `candidate_project` (сознательное отличие от `staffing_demand`, так задано) |
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

## Enum-типы

| Enum | Значения |
|------|----------|
| `candidate_project` | Самокат, Купер, ДонатсКофе, Яндекс Лавка, Яндекс РБ, Газпромнефть, Евроторг, Мастер Деливери, Мастер Деливери Таксопарк, Азбука вкуса, Бургер кинг Россия, Далли (12) |
| `candidate_stage` | Прибыл на проект, Отработал 1 смену, Отработал 10 смен, Завершил вахту (4) |
| `candidate_list_type` | recruiter, manager, coordinator, city, position (5) |
| `staffing_demand_history_action` | insert, update, delete (3) |

Значения проектов и стадий заданы бизнесом дословно и не переименовываются.
Изменение состава enum — это миграция схемы, а не правка справочника.

## Архивирование и обновление

- **Кандидаты не удаляются физически** — архивируются через
  `archived_at = now()` и восстанавливаются через `archived_at = null`
  (см. `candidatesRepo.archiveCandidate` / `restoreCandidate`).
- **Справочники не удаляются физически** — деактивируются через
  `is_active = false`. `DELETE`-политика была намеренно удалена в последней
  миграции; функции hard-delete в репозитории нет.
- **Потребность (`staffing_demand`) удаляется физически** — это единственное
  исключение из общего правила soft-delete, см. раздел таблицы выше.
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

Типы: [`candidates.types.ts`](../../src/lib/supabase/candidates.types.ts),
[`candidateListOptions.types.ts`](../../src/lib/supabase/candidateListOptions.types.ts),
[`staffingDemand.types.ts`](../../src/lib/supabase/staffingDemand.types.ts),
[`staffingDemandRows.types.ts`](../../src/lib/supabase/staffingDemandRows.types.ts),
[`staffingDemandHistory.types.ts`](../../src/lib/supabase/staffingDemandHistory.types.ts)
— выведены из `database.types.ts` (`Row`/`Insert`/`Update`/`Enums`).

## Переменные окружения

В `.env.local` (в репозиторий не коммитятся, покрыто `.gitignore` через `.env*`):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

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
- `src/lib/portal/vacancyData.ts` — из Excel «Описание вакансий» (не БД, но
  тоже генерируемый и не редактируется вручную).
