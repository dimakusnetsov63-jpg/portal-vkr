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
