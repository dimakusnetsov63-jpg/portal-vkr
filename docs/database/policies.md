# Политики доступа (RLS)

Модель доступа к данным в Postgres/Supabase. Схема таблиц — [`schema.md`](schema.md),
решение об этой модели и его цена — [`ADR-004-portal-auth.md`](../architecture/decisions/ADR-004-portal-auth.md).
Правила ролей на языке бизнеса — [`../requirements/access-control.md`](../requirements/access-control.md).

## Действующая модель

RLS включён на **всех восьми** таблицах схемы `public`. Политики созданы
только для роли `authenticated`; для `anon` политик нет ни на одной таблице —
неавторизованный доступ запрещён по умолчанию.

С июля 2026 политики **не безусловные**. Каждая ссылается на
`public.portal_can('<раздел>')` — есть ли у текущего пользователя доступ к
разделу, к которому относится таблица:

```sql
create policy "portal_select_staffing_demand"
  on public.staffing_demand for select to authenticated
  using (public.portal_can('demand'));
```

`portal_can` читает роль и `is_active` **из `portal_users`**, а не из JWT.
Практические следствия:

- смена роли действует со следующего запроса, перевыпуск токена не нужен;
- отключение сотрудника закрывает данные сразу, не дожидаясь истечения его
  токена доступа (15 минут).

## Состав политик по таблицам

| Таблица | Раздел | select | insert | update | delete |
|---|---|:--:|:--:|:--:|:--:|
| `candidates` | `candidates` | ✅ | ✅ | ✅ | ❌ |
| `candidate_list_options` | `candidates` (чтение) / `settings` (запись) | ✅ | ✅ | ✅ | ❌ |
| `staffing_demand` | `demand` | ✅ | ✅ | ✅ | **✅** |
| `staffing_demand_rows` | `demand` | ✅ | ✅ | ✅ | ❌ |
| `staffing_demand_history` | `demand` | ✅ | ❌ | ❌ | ❌ |
| `portal_users` | — | ❌ | ❌ | ❌ | ❌ |
| `portal_sessions` | — | ❌ | ❌ | ❌ | ❌ |
| `portal_audit_log` | — | ❌ | ❌ | ❌ | ❌ |

Обоснование исключений:

- **`staffing_demand` — единственная таблица с delete-политикой.** Очистка
  ячейки в матрице это физическое удаление строки (у таблицы нет
  `archived_at`), поэтому право на `delete` необходимо для работы UI. Оно
  осталось у всех, у кого есть раздел «Потребность»: это штатное действие
  координатора, а не административная операция.
- **`candidates` и `candidate_list_options` без delete** — используется
  soft-delete: `archived_at` у кандидатов, `is_active = false` у справочников.
- **`candidate_list_options`: читают все, правит только «Настройки».**
  Подсказки нужны в карточке кандидата любой роли, а редактируются лишь в
  одном месте.
- **`staffing_demand_history` только на чтение** — записи создаются
  исключительно триггерами `log_staffing_demand_change` и
  `log_staffing_demand_rows_change` (`SECURITY DEFINER`).
- **Три таблицы `portal_*` закрыты полностью** — ни одной политики, гранты
  отозваны. Работа с ними идёт только через `SECURITY DEFINER` функции,
  которые сами проверяют право вызывающего. Поэтому `password_hash` не может
  уехать клиенту: маршрута, который бы его вернул, не существует.

## Функции доступа

| Функция | Кому доступна | Назначение |
|---|---|---|
| `portal_can(section)` | anon, authenticated | Есть ли у запроса доступ к разделу. Используется в политиках |
| `portal_role_sections(role)` | anon, authenticated | Матрица «роль → разделы». Дубль `src/lib/auth/roles.ts` |
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

1. **Нет разграничения по проектам.** `portal_users.projects` заполняется и
   отображается, но ни одна политика по нему не фильтрует.
2. **Вся PII доступна всем ролям с разделом «Кандидаты»** — то есть всем
   четырём. ФИО, телефон, telegram, `salary_card`. Для 152-ФЗ это требует
   внимания.
3. **Матрица прав продублирована** в SQL (`portal_role_sections`) и TS
   (`src/lib/auth/roles.ts`). Рассинхронизацию не поймают ни типы, ни тесты.
4. **`portal_login` доступен `anon`** — иначе форма входа не работала бы.
   Защита от перебора: 10 неудачных попыток на логин за 15 минут.

## Как проверить политики в боевой базе

```bash
npx supabase db query --linked "select tablename, policyname, cmd, roles::text, qual::text from pg_policies where schemaname='public' order by tablename, cmd"
```

Проверить гранты на функции:

```bash
npx supabase db query --linked "select p.proname, array_agg(a.rolname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace left join aclexplode(p.proacl) x on true left join pg_roles a on a.oid=x.grantee where n.nspname='public' and p.proname like 'portal%' group by p.proname order by p.proname"
```

Оба запроса read-only и безопасны для прода.
