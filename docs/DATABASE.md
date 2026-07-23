# База данных (Supabase / Postgres)

Схема описана по реальным миграциям в
[`../supabase/migrations/`](../supabase/migrations/) и сгенерированным типам
[`../src/lib/supabase/database.types.ts`](../src/lib/supabase/database.types.ts).
Секреты, реальный URL проекта и значения ключей сюда не записываются.

Источник истины — миграции. Если что-то не подтверждено миграцией или типами,
это явно отмечено ниже.

## Таблицы

Подтверждены две таблицы в схеме `public`: `candidates` и
`candidate_list_options`. Auth-таблицы (`auth.users` и т.п.) управляются
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
(recruiter/manager/coordinator/city). **Не ограничивает** значения в
`candidates.*` — только курирует подсказки в выпадающих списках.

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

## Enum-типы

| Enum | Значения |
|------|----------|
| `candidate_project` | Самокат, Купер, ДонатсКофе, Яндекс Лавка, Яндекс РБ, Газпромнефть, Евроторг, Мастер Деливери, Мастер Деливери Таксопарк, Азбука вкуса, Бургер кинг Россия, Далли (12) |
| `candidate_stage` | Прибыл на проект, Отработал 1 смену, Отработал 10 смен, Завершил вахту (4) |
| `candidate_list_type` | recruiter, manager, coordinator, city (4) |

Значения проектов и стадий заданы бизнесом дословно и не переименовываются.
Изменение состава enum — это миграция схемы, а не правка справочника.

## Архивирование и обновление

- **Кандидаты не удаляются физически** — архивируются через
  `archived_at = now()` и восстанавливаются через `archived_at = null`
  (см. `candidatesRepo.archiveCandidate` / `restoreCandidate`).
- **Справочники не удаляются физически** — деактивируются через
  `is_active = false`. `DELETE`-политика была намеренно удалена в последней
  миграции; функции hard-delete в репозитории нет.
- `updated_at` в `candidates` поддерживается триггером автоматически.

## Репозитории (data-слой)

- [`candidatesRepo.ts`](../src/lib/supabase/candidatesRepo.ts): `listCandidates`,
  `createCandidate`, `updateCandidate`, `archiveCandidate`, `restoreCandidate`.
- [`candidateListOptionsRepo.ts`](../src/lib/supabase/candidateListOptionsRepo.ts):
  `listCandidateListOptions`, `createCandidateListOption`,
  `updateCandidateListOption` (переименование / `is_active` / `sort_order`).
  Функции hard-delete нет намеренно.

Типы: [`candidates.types.ts`](../src/lib/supabase/candidates.types.ts),
[`candidateListOptions.types.ts`](../src/lib/supabase/candidateListOptions.types.ts)
— выведены из `database.types.ts` (`Row`/`Insert`/`Update`/`Enums`).

## Переменные окружения

В `.env.local` (в репозиторий не коммитятся, покрыто `.gitignore` через `.env*`):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Читаются только через статический `process.env.X` в
[`env.ts`](../src/lib/supabase/env.ts) (динамический `process.env[name]` не
инлайнится Turbopack в клиентский бандл). Реальные значения в документацию не
записываются. На Vercel эти же переменные заданы в настройках проекта.

## Безопасность (RLS)

- Обе таблицы: **RLS включён**, политики только для роли `authenticated`.
  `using (true)` / `with check (true)` безопасны здесь, потому что применяются
  к уже авторизованной роли, а не к `anon` — неавторизованный доступ запрещён
  по умолчанию.
- Политики `anon` **не создаются** ни для одной таблицы.
- В коде используется **только publishable-ключ** (и в браузере, и на сервере);
  `service_role` в приложении не применяется. Доступ регулируется RLS + auth.
  (Примечание: комментарий в самой первой миграции упоминает `service_role` как
  временную модель до появления auth — она уже неактуальна, текущий код на
  publishable-ключе.)
- Учётные записи сотрудников заводятся вручную в Supabase Dashboard;
  самостоятельной регистрации нет.

## Правила миграций и генерации типов

1. Любое изменение схемы — **новая** миграция в `supabase/migrations/`
   (не править существующие применённые миграции).
2. После применения миграции — **регенерация** типов:
   `supabase gen types typescript` → `src/lib/supabase/database.types.ts`.
3. `database.types.ts` — **генерируемый файл, вручную не редактируется.**
4. Не менять названия полей/enum без отдельного согласования и миграции.
5. Названия существующих проектов и стадий менять нельзя (жёстко заданы бизнесом).

## Генерируемые файлы

- `src/lib/supabase/database.types.ts` — из `supabase gen types typescript`.
- `src/lib/portal/vacancyData.ts` — из Excel «Описание вакансий» (не БД, но
  тоже генерируемый и не редактируется вручную).
