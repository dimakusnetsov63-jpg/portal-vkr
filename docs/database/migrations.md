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
- партиционирования и политики хранения для растущей `staffing_demand_history`.

`20260729130000_create_addresses.sql` (и две последующие), `20260728120000_portal_auth.sql`
и `20260731100000_rates_list_types.sql`…`20260731100300_update_portal_role_sections_rates.sql`
**применены к боевой БД**; `database.types.ts` регенерирован — `addresses`,
`rate_cards`/`rates` и `portal_users`/`portal_sessions`/`portal_audit_log` в
нём отражены (см. `schema.md`).

Технически применены не через `supabase db push` (в среде разработки
заблокирован прямой Postgres-протокол, порты 5432/6543 — доходит только
HTTPS до Management API), а вручную через SQL Editor Supabase, с ручной
регистрацией версий в `supabase_migrations.schema_migrations` — файлы
миграций от этого не отличаются от применённых штатным способом.
