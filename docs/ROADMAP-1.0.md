# Роадмап до версии 1.0 — портал ВКР

План доведения портала до коммерческой версии 1.0. Основан на находках
аудита [`AUDIT-2026-07.md`](AUDIT-2026-07.md) — ссылки вида «(§5.1)» ведут в
его разделы.

## Принципы

1. **Сначала — правда о данных.** Продукт нельзя продавать, пока половина
   экранов показывает выдуманные цифры. Это выше по приоритету, чем любые
   новые функции.
2. **Права — до функций.** Каждая новая возможность в системе без модели прав
   увеличивает объём переделки позже.
3. **Одна задача — один коммит** (правило проекта). Каждое ТЗ ниже
   рассчитано на отдельный коммит; крупные разбиты на этапы.
4. **Ничего не ломать по пути.** После каждого ТЗ: `npx tsc --noEmit` →
   `npm run test` → `npm run lint` → `npm run build`.
5. **Схема меняется только миграцией** + регенерацией `database.types.ts`.

## Карта фаз

| Фаза | Название | Приоритет | Блокирует 1.0 |
|------|----------|-----------|----------------|
| 0 | Экстренная безопасность | P0 | Да |
| 1 | Идентичность и права | P0 | Да |
| 2 | Данные вместо выдумки | P0 | Да |
| 3 | Масштаб и производительность | P1 | Да |
| 4 | Зрелость интерфейса | P1 | Частично |
| 5 | Готовность к эксплуатации | P1 | Да |
| 6 | После 1.0 | P2 | Нет |

Оценки — в человеко-днях для одного разработчика, знакомого с кодовой базой.

---

# Фаза 0. Экстренная безопасность

**Приоритет P0. Оценка: 2–3 дня. Делать первой, до любой другой работы.**

Эти задачи закрывают дыры, которые эксплуатируются прямо сейчас, и не требуют
изменения архитектуры.

---

## ТЗ-01. Закрыть самостоятельную регистрацию

**Приоритет:** P0 (блокер) · **Оценка:** 0.5 дня · **Аудит:** §5.2

### Цель

Привести конфигурацию Supabase в соответствие с заявленной моделью продукта:
учётные записи заводятся только вручную.

### Что сделать

1. **Проверить боевой проект** (Supabase Dashboard → Authentication →
   Sign In / Providers):
   - `Allow new users to sign up` — **выключить**;
   - `Confirm email` — включить;
   - `Minimum password length` — 12;
   - `Secure password change` — включить (требовать текущий пароль).
2. Привести `supabase/config.toml` в соответствие, чтобы локальный стек не
   расходился с боевым:

```toml
[auth]
enable_signup = false
minimum_password_length = 12

[auth.email]
enable_signup = false
enable_confirmations = true
secure_password_change = true
```

3. Поднять клиентский минимум в `src/app/update-password/page.tsx`:
   `MIN_PASSWORD_LENGTH = 12`.
4. Зафиксировать в [`database/schema.md`](database/schema.md), что настройки боевого проекта
   проверены и когда.

### Критерии приёмки

- Попытка `supabase.auth.signUp()` из консоли браузера на боевом URL
  возвращает ошибку «Signups not allowed».
- Пароль короче 12 символов не принимается ни на `/update-password`, ни через
  API.
- `supabase start` локально ведёт себя так же, как боевой проект.

### Риски

Включение `enable_confirmations` требует настроенного SMTP. Проверить, что
письма уходят, **до** включения — иначе новые сотрудники не смогут войти.

---

## ТЗ-02. Заголовки безопасности

**Приоритет:** P0 · **Оценка:** 0.5 дня · **Аудит:** §5.3

### Цель

Запретить встраивание портала в чужие страницы и ограничить источники
загрузки.

### Что сделать

Заполнить `next.config.ts`:

```ts
import type { NextConfig } from "next";

const supabaseOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin;

// CSP: 'unsafe-inline' для style-src обязателен — CSS Modules и inline-стили
// компонентов (StatCard, аватары) без него не работают. script-src оставлен
// строгим; Next.js inline-скрипты покрываются 'self' + nonce не требуются,
// пока не добавлены сторонние скрипты.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
```

### Критерии приёмки

- `curl -I https://<домен>/` возвращает все шесть заголовков.
- Портал открывается без ошибок CSP в консоли: вход, кандидаты (включая
  экспорт CSV через `blob:`), потребность, вакансии.
- Попытка открыть портал в `<iframe>` на стороннем домене блокируется.

### Риски

CSP легко ломает экспорт CSV (`blob:` в `img-src`/`connect-src`) и шрифты.
Проверять каждый раздел вручную, а не только главную.

---

## ТЗ-03. Ограничения длины и нормализация на уровне БД

**Приоритет:** P0 · **Оценка:** 0.5 дня · **Аудит:** §4.4, §4.6

### Цель

Сделать так, чтобы прямая запись в PostgREST в обход интерфейса не могла
испортить данные.

### Миграция

`supabase/migrations/<timestamp>_data_integrity_constraints.sql`:

```sql
-- Ограничения длины для свободнотекстовых полей. Клиент пишет в PostgREST
-- напрямую, серверного слоя нет — CHECK здесь единственная реальная защита
-- от мусорных значений (ср. staffing_demand_rows.comment, где такой CHECK
-- уже есть с самого начала).

alter table public.candidates
  add constraint candidates_full_name_length_check
    check (char_length(full_name) between 1 and 200),
  add constraint candidates_phone_length_check
    check (phone is null or char_length(phone) <= 40),
  add constraint candidates_comment_length_check
    check (comment is null or char_length(comment) <= 4000),
  add constraint candidates_salary_card_length_check
    check (salary_card is null or char_length(salary_card) <= 200),
  add constraint candidates_city_length_check
    check (city is null or char_length(city) <= 120);

-- Нормализация города: "Москва", "москва" и "Москва " не должны порождать
-- три разные строки матрицы «Потребности». Триггер приводит значение к
-- каноничному виду при любой записи, включая прямую через PostgREST.
create function public.normalize_city()
returns trigger
language plpgsql
as $$
begin
  new.city := nullif(btrim(regexp_replace(new.city, '\s+', ' ', 'g')), '');
  return new;
end;
$$;

create trigger trg_candidates_normalize_city
  before insert or update on public.candidates
  for each row execute function public.normalize_city();

create trigger trg_staffing_demand_normalize_city
  before insert or update on public.staffing_demand
  for each row execute function public.normalize_city();

create trigger trg_staffing_demand_rows_normalize_city
  before insert or update on public.staffing_demand_rows
  for each row execute function public.normalize_city();

alter table public.staffing_demand
  add constraint staffing_demand_city_length_check
    check (char_length(city) between 1 and 120);
```

**Перед применением** прогнать на копии базы поиск уже существующих
расхождений и слить их вручную:

```sql
select city, count(*) from public.staffing_demand
group by city order by lower(btrim(city));
```

### Что сделать в коде

После применения — регенерация `database.types.ts`. Кода менять не нужно
(ограничения только сужают допустимые значения).

### Критерии приёмки

- `insert` с `full_name` из 10 000 символов отклоняется базой.
- Запись города `"  москва  "` сохраняется как `москва`; города с хвостовыми
  пробелами больше не появляются в матрице отдельными строками.
- Все 121 существующий тест зелёные.

---

## ТЗ-04. Человеческие сообщения об ошибках

**Приоритет:** P0 · **Оценка:** 0.5 дня · **Аудит:** §5.5

### Цель

Перестать показывать пользователю текст ошибок PostgREST (имена ограничений,
колонок, фрагменты SQL).

### Что сделать

1. Новый файл `src/lib/supabase/errors.ts` — чистая функция без React:

```ts
import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Переводит ошибку Supabase в текст для пользователя. Технические детали
 * (имена ограничений, колонок, SQL) наружу не отдаются — они уходят только
 * в мониторинг. Коды PostgREST: 23505 = unique_violation,
 * 23514 = check_violation, 42501 = insufficient_privilege (у нас = RLS).
 */
export function toUserMessage(error: unknown, fallback: string): string { … }
```

Сопоставление кодов:

| Код | Сообщение |
|-----|-----------|
| `23505` | «Такая запись уже существует» |
| `23514` | «Значение не проходит проверку — исправьте поле» |
| `23503` | «Связанная запись не найдена» |
| `42501`, `PGRST301` | «Недостаточно прав для этого действия» |
| сетевые | «Нет связи с сервером. Проверьте соединение» |
| прочее | `fallback` |

2. Заменить во всех `catch` в `PortalContext.tsx` (их 12):
   `e instanceof Error ? e.message : "…"` → `toUserMessage(e, "…")`.
3. Тесты `src/lib/supabase/errors.test.ts` — по одному на каждый код.

### Критерии приёмки

- Ни в одном тосте не появляется текст, содержащий `constraint`, `column`,
  `violates`, `relation`.
- Тесты на `toUserMessage` покрывают все коды из таблицы.

---

# Фаза 1. Идентичность и права

**Приоритет P0. Оценка: 8–12 дней. Главный блокер версии 1.0.**

Без этой фазы продукт нельзя продать никому, у кого больше одного сотрудника.

---

## ТЗ-05. Таблица профилей сотрудников

**Приоритет:** P0 (блокер) · **Оценка:** 2 дня · **Аудит:** §4.1

### Цель

Дать системе понятие «сотрудник»: имя, роль, статус, привязка к
`auth.users`. Без этого невозможны ни права, ни читаемый журнал изменений.

### Миграция

`supabase/migrations/<timestamp>_create_profiles.sql`:

```sql
-- Профили сотрудников. Одна строка на учётную запись auth.users.
-- Заводятся вручную (самостоятельной регистрации нет), поэтому строка
-- создаётся триггером на auth.users с ролью по умолчанию 'viewer' —
-- минимальные права, повышает администратор осознанно.

create type public.app_role as enum ('admin', 'manager', 'recruiter', 'viewer');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role public.app_role not null default 'viewer',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_full_name_length_check
    check (char_length(full_name) <= 200)
);

comment on table public.profiles is
  'Сотрудники портала. id = auth.users.id. Роль по умолчанию viewer (минимум прав); повышение — только администратором.';
comment on column public.profiles.is_active is
  'false = доступ отозван без удаления учётной записи. Проверяется в helper-функциях RLS.';

create trigger trg_profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_candidates_updated_at();

create index idx_profiles_role on public.profiles (role);

-- Автосоздание профиля при заведении учётной записи в Dashboard.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger trg_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper-функции для политик RLS. SECURITY DEFINER + stable: читают
-- profiles в обход RLS этой же таблицы (иначе рекурсия политик) и
-- кешируются планировщиком в пределах запроса.
create function public.current_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles
  where id = auth.uid() and is_active
$$;

create function public.has_role(required variadic public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role() = any(required)
$$;

alter table public.profiles enable row level security;

create policy "authenticated_select_profiles"
  on public.profiles for select to authenticated using (true);

-- Свой профиль (кроме роли) правит сам сотрудник; роль и is_active —
-- только администратор. Разделение через две политики + CHECK в триггере.
create policy "self_update_profile"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "admin_manage_profiles"
  on public.profiles for update to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin'));

-- Защита от повышения прав самому себе: сотрудник не админ — роль и
-- is_active менять не может, даже проходя self_update_profile.
create function public.guard_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.role is distinct from old.role or new.is_active is distinct from old.is_active)
     and not public.has_role('admin') then
    raise exception 'Only an admin can change role or is_active';
  end if;
  return new;
end;
$$;

create trigger trg_profiles_guard_role
  before update on public.profiles
  for each row execute function public.guard_profile_role_change();
```

### Что сделать в коде

- `src/lib/supabase/profiles.types.ts` — типы из `database.types.ts`.
- `src/lib/supabase/profilesRepo.ts` — `listProfiles`, `getMyProfile`,
  `updateProfile`.
- `PortalContext`: `myProfile`, `profiles`, `profilesLoading`; заменить
  `authEmail` на `myProfile` в `Topbar` (показывать имя, а не email).
- **После применения**: вручную назначить роль `admin` первому сотруднику в
  Dashboard.

### Критерии приёмки

- Новая учётная запись, созданная в Dashboard, автоматически получает профиль
  с ролью `viewer`.
- Сотрудник с ролью `recruiter` не может обновить себе `role = 'admin'` —
  запрос падает с ошибкой триггера.
- `Topbar` показывает имя сотрудника вместо email.

### Риски

Триггер на `auth.users` — единственное место, где проект трогает схему
`auth`. Проверить, что он переживает обновления Supabase (не создавать
зависимостей от внутренних колонок, кроме `id` и `raw_user_meta_data`).

---

## ТЗ-06. Матрица прав и переписывание RLS

**Приоритет:** P0 (блокер) · **Оценка:** 3 дня · **Аудит:** §5.1

### Цель

Заменить `using (true)` на реальную модель доступа.

### Целевая матрица

| Действие | admin | manager | recruiter | viewer |
|----------|:-----:|:-------:|:---------:|:------:|
| Кандидаты — чтение | все | все | все | все |
| Кандидаты — создание | ✅ | ✅ | ✅ | ❌ |
| Кандидаты — изменение | все | все | **свои** | ❌ |
| Кандидаты — архив/восстановление | ✅ | ✅ | **свои** | ❌ |
| Потребность — чтение | ✅ | ✅ | ✅ | ✅ |
| Потребность — запись | ✅ | ✅ | ❌ | ❌ |
| Потребность — удаление ячейки | ✅ | ✅ | ❌ | ❌ |
| Статус/комментарий строки | ✅ | ✅ | ❌ | ❌ |
| Справочники | ✅ | ✅ | ❌ | ❌ |
| Профили и роли | ✅ | ❌ | ❌ | ❌ |
| Журнал изменений | ✅ | ✅ | ✅ | ✅ |

«Свои» для рекрутера = `candidates.recruiter` совпадает с
`profiles.full_name` текущего пользователя. Это временное решение на строковом
сравнении; ТЗ-07 переводит его на `recruiter_id`.

### Миграция

`supabase/migrations/<timestamp>_rbac_policies.sql` — удалить все
существующие политики и создать новые. Образец для одной таблицы:

```sql
drop policy if exists "authenticated_select_candidates" on public.candidates;
drop policy if exists "authenticated_insert_candidates" on public.candidates;
drop policy if exists "authenticated_update_candidates" on public.candidates;

create policy "select_candidates"
  on public.candidates for select to authenticated
  using (public.current_role() is not null);

create policy "insert_candidates"
  on public.candidates for insert to authenticated
  with check (public.has_role('admin', 'manager', 'recruiter'));

create policy "update_candidates"
  on public.candidates for update to authenticated
  using (
    public.has_role('admin', 'manager')
    or (
      public.has_role('recruiter')
      and recruiter = (select full_name from public.profiles where id = auth.uid())
    )
  )
  with check (
    public.has_role('admin', 'manager')
    or (
      public.has_role('recruiter')
      and recruiter = (select full_name from public.profiles where id = auth.uid())
    )
  );
```

Аналогично для `staffing_demand` (запись только `admin`/`manager`, `delete`
только им же), `staffing_demand_rows`, `candidate_list_options`.

`current_role() is not null` работает как проверка «профиль существует и
активен» — деактивированный сотрудник (`is_active = false`) не видит ничего,
даже имея валидную сессию.

### Что сделать в коде

1. `src/lib/portal/permissions.ts` — **чистая** зеркальная логика для UI:

```ts
export type AppRole = "admin" | "manager" | "recruiter" | "viewer";

export function canEditDemand(role: AppRole | null): boolean { … }
export function canEditCandidate(role: AppRole | null, recruiterName: string | null, myName: string): boolean { … }
export function canManageLists(role: AppRole | null): boolean { … }
export function canManageUsers(role: AppRole | null): boolean { … }
```

2. Применить в UI — **прятать или блокировать, а не позволять и падать**:
   - `DemandCell` — `onClick` не открывает редактор без `canEditDemand`;
   - `DemandToolbar` — кнопка «Добавить потребность» скрыта;
   - `CandidatesSection` — «Добавить кандидата» скрыта для `viewer`;
   - `RealCandidateDrawer` — поля `readOnly`, кнопки скрыты;
   - `SettingsSection` — панель справочников только для `admin`/`manager`.
3. Тесты `permissions.test.ts` — по строке матрицы на каждую роль.

### Критерии приёмки

- Для каждой роли из матрицы: запрещённое действие не отображается в UI **и**
  отклоняется базой при прямом вызове из консоли.
- `viewer` видит данные, но ни одна кнопка записи ему не доступна.
- Рекрутер может изменить своего кандидата и получает ошибку прав на чужого.
- Деактивированный (`is_active = false`) сотрудник не читает ни одной строки.

### Риски

Самое опасное место всего роадмапа. Ошибка в политике либо закрывает доступ
всем, либо оставляет дыру. Обязательно выполнить вместе с **ТЗ-07** (тесты
RLS) — без автоматической проверки эту матрицу невозможно поддерживать.

---

## ТЗ-07. Автотесты RLS-политик

**Приоритет:** P0 · **Оценка:** 2 дня · **Аудит:** §8.2

### Цель

Сделать матрицу прав проверяемой автоматически. Без этого любая последующая
миграция может незаметно открыть доступ.

### Что сделать

1. Отдельный проект Supabase (или `supabase start` локально) как тестовый
   стенд; в CI — `supabase start`.
2. Скрипт `npm run test:rls`, отдельная конфигурация Vitest
   (`vitest.rls.config.ts`, include `src/**/*.rls-test.ts`), потому что этим
   тестам нужны сеть и реальная база — в отличие от чистых unit-тестов.
3. Фикстура: создать по одному пользователю на роль через
   `service_role`-клиент (**только в тестовом окружении, никогда в `src/`**),
   получить их сессии, дальше работать обычным publishable-клиентом.
4. Для каждой ячейки матрицы прав из ТЗ-06 — тест вида:

```ts
it("recruiter cannot update another recruiter's candidate", async () => {
  const { error } = await asRecruiter.from("candidates")
    .update({ city: "Казань" }).eq("id", otherRecruitersCandidateId);
  expect(error).not.toBeNull();
});
```

5. Обязательно негативные тесты: `anon` не читает ни одну таблицу;
   деактивированный профиль не читает ничего; `authenticated` не может писать
   в `staffing_demand_history`.

### Критерии приёмки

- Тестов не меньше, чем ячеек в матрице ТЗ-06 (≈40).
- Если в политике заменить условие на `using (true)`, соответствующий тест
  падает.
- `npm run test:rls` проходит на чистой базе после всех миграций.

### Риски

`service_role`-ключ в тестовом окружении. Хранить только в переменных CI,
никогда не импортировать из `src/`, добавить проверку в ESLint-конфиг на
запрет импорта `SUPABASE_SERVICE_ROLE_KEY` вне `*.rls-test.ts`.

---

## ТЗ-08. Ответственные — ссылками, а не строками

**Приоритет:** P1 · **Оценка:** 2 дня · **Аудит:** §4.1, §5.1

### Цель

Перевести `candidates.recruiter/manager/coordinator` со свободного текста на
FK к `profiles`. Это делает права из ТЗ-06 надёжными (сейчас доступ рекрутера
к «своим» кандидатам держится на совпадении строк с ФИО).

### Миграция

Двухэтапно, без потери данных:

```sql
-- Этап 1: добавить колонки-ссылки, старые текстовые оставить как есть.
alter table public.candidates
  add column recruiter_id uuid references public.profiles (id),
  add column manager_id uuid references public.profiles (id),
  add column coordinator_id uuid references public.profiles (id);

create index idx_candidates_recruiter_id on public.candidates (recruiter_id);
create index idx_candidates_manager_id on public.candidates (manager_id);
create index idx_candidates_coordinator_id on public.candidates (coordinator_id);

-- Этап 2: заполнить по точному совпадению ФИО. Несопоставленные остаются
-- NULL — текстовое поле сохраняется, данные не теряются.
update public.candidates c
set recruiter_id = p.id
from public.profiles p
where btrim(c.recruiter) = btrim(p.full_name) and c.recruiter_id is null;
-- то же для manager / coordinator
```

Старые текстовые колонки **не удалять** в рамках 1.0 — они остаются
источником истины для исторических записей и для значений, которым не нашлось
профиля.

Отчёт о несопоставленных строках — обязательная часть приёмки:

```sql
select recruiter, count(*) from public.candidates
where recruiter is not null and recruiter_id is null
group by recruiter order by 2 desc;
```

### Что сделать в коде

- `RealCandidateDrawer`/`AddCandidateModal`: `Combobox` по свободному тексту →
  `select` по активным профилям (с сохранением текстового значения для
  обратной совместимости).
- Политику `update_candidates` из ТЗ-06 переписать на `recruiter_id =
  auth.uid()` — надёжнее строкового сравнения.
- `candidateFilters.ts` — фильтр по ответственному по id.

### Критерии приёмки

- Отчёт по несопоставленным строкам приложен к задаче и разобран вручную.
- Права рекрутера работают через `recruiter_id`, а не по совпадению ФИО.
- Переименование сотрудника в профиле больше не отвязывает от него
  кандидатов.

---

# Фаза 2. Данные вместо выдумки

**Приоритет P0. Оценка: 8–10 дней.**

Каждый экран должен показывать либо настоящие данные, либо честное «данных
пока нет». Третьего в коммерческом продукте не существует.

---

## ТЗ-09. Убрать выдуманные данные из интерфейса

**Приоритет:** P0 (блокер) · **Оценка:** 1 день · **Аудит:** §7.1

### Цель

Немедленно прекратить показ вымышленных цифр и нерабочих переключателей —
до того, как соответствующие разделы получат реальные данные.

Это **не** реализация функций, а честность интерфейса. Делается быстро и
отдельным коммитом.

### Что сделать

| Файл | Действие |
|------|----------|
| `sections/OverviewSection.tsx` | Плитки, зависящие от несуществующих данных, — на `NoDataState` («Раздел в разработке»). Массив `RISKS` удалить. Оставить только то, что считается из `realCandidates`/`demandRows` |
| `sections/AnalyticsSection.tsx`, `AnalyticsTabs.tsx` | Скрыть раздел из `NAV_ITEMS` до ТЗ-11 либо показать `NoDataState` |
| `sections/MarketingSection.tsx` | То же; константу `CHANNELS` удалить |
| `sections/SettingsSection.tsx` | Панели «Профиль» и «Команда» — на реальные `profiles` (ТЗ-05). Панель «Интеграции» **удалить целиком** |
| `sections/SettingsSection.tsx` | Тумблеры «Уведомления» — либо сохранять в `profiles`, либо удалить |
| `lib/portal/constants.ts` | Удалить `PROJECTS`, `CHANNELS`, `RECRUITERS`, `MANAGERS`, `COORDINATORS` вместе с их потребителями |
| `sections/OverviewSection.tsx` | Убрать зашитую дату «Понедельник, 20 июля 2026» → вычислять |

Перед удалением каждого — grep по проекту (правило CLAUDE.md §3.11).

### Критерии приёмки

- В интерфейсе нет ни одного числа, не полученного из Supabase или не
  помеченного явно как «нет данных».
- Названия «X5 Group», «ВкусВилл», «Ozon Fresh» не встречаются в `src/`.
- Ни один переключатель не сообщает об успехе действия, которого не было.
- `npm run build` проходит, мёртвых импортов не осталось.

---

## ТЗ-10. Реальный раздел «Обзор»

**Приоритет:** P0 · **Оценка:** 2 дня · **Аудит:** §7.1

### Цель

Собрать сводку из данных, которые уже есть в базе.

### Что сделать

1. `sections/overview/overviewMetrics.ts` — **чистая** функция
   `calculateOverviewMetrics(candidates, demandRows, window)`:

| Плитка | Формула |
|--------|---------|
| Активных проектов | различных `project` в `demandRows` за окно |
| Потребность на 30 дней | сумма `planned_count` за `[сегодня, +30]` |
| Кандидатов в работе | не архивных `candidates` |
| Вышли на 1-ю смену за 30 дней | `first_shift_at` в `[−30, сегодня]` |
| Есть медкнижка | доля `has_medical_book = true` |
| Строк на паузе/закрытых | из `demandRowMeta` |

2. Блок «Требуют внимания» — вместо выдуманного `RISKS`: строки матрицы со
   статусом `paused`/`closed`, у которых при этом есть ненулевая потребность
   в будущем. Это настоящий сигнал, вычислимый из имеющихся данных.
3. Разделить `OverviewSection` на папку по образцу `candidates/`.
4. Тесты на `overviewMetrics.ts`, включая пустую выборку (0, не `NaN`).

### Критерии приёмки

- Каждое число на «Обзоре» воспроизводится SQL-запросом к базе.
- Пустая база даёт нули и `EmptyState`, а не `NaN` и не пустые плитки.
- Метрики пересчитываются после изменения ячейки потребности.

---

## ТЗ-11. Аналитика на реальных данных

**Приоритет:** P1 · **Оценка:** 3 дня · **Аудит:** §7.1, §3.3

### Цель

Перевести «Аналитику» с mock-генераторов на Supabase и убрать mock-слой из
контекста.

### Что сделать

1. Определить состав отчётов (согласовать с заказчиком до реализации):
   - воронка по стадиям (`candidate_stage`) с фильтром по проекту/периоду;
   - план против факта: `sum(planned_count)` против числа `first_shift_at` по
     проекту/городу/периоду;
   - динамика выходов по неделям;
   - структура по городам.
2. Агрегация — **на стороне БД** через SQL-функции (`rpc`), не в браузере:

```sql
create function public.demand_vs_actual(
  from_date date, to_date date, project_filter text default null
) returns table (project text, city text, planned bigint, actual bigint)
language sql stable security invoker as $$ … $$;
```

   `security invoker` — обязательно: функция должна уважать RLS вызывающего.
3. `src/lib/supabase/analyticsRepo.ts` — обёртки над `rpc`.
4. Удалить `generateCandidates.ts`, `generateDemand.ts`, mock-слой из
   `PortalContext` (`candidates`, `addCandidate`, `addComment`,
   `selectedCandidateId`), `sections/CandidateDrawer.tsx`.
5. `CommandPalette` перевести на `realCandidates` (§3.3, §7.8).

### Критерии приёмки

- В `src/` не осталось генераторов случайных данных.
- `⌘K` находит реальных кандидатов и открывает `RealCandidateDrawer`.
- Отчёты совпадают с ручной проверкой SQL на тестовых данных.
- `PortalContext` уменьшился минимум на 100 строк.

---

## ТЗ-12. Проекты — справочник вместо enum

**Приоритет:** P1 · **Оценка:** 2 дня · **Аудит:** §4.2, §4.3

### Цель

Дать администратору возможность заводить проекты без миграции и деплоя.

### Миграция

```sql
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint projects_name_length_check check (char_length(name) between 1 and 200)
);

-- Перенос значений существующего enum, порядок сохраняется.
insert into public.projects (name, sort_order)
select unnest(enum_range(null::public.candidate_project))::text,
       generate_series(1, array_length(enum_range(null::public.candidate_project), 1));

alter table public.candidates add column project_id uuid references public.projects (id);
alter table public.staffing_demand add column project_id uuid references public.projects (id);
alter table public.staffing_demand_rows add column project_id uuid references public.projects (id);

update public.candidates c set project_id = p.id
from public.projects p where c.project::text = p.name;
-- то же для staffing_demand и staffing_demand_rows
```

Колонки-enum **оставить** до 1.0 (двойная запись), удалять отдельной задачей
после 1.0, когда весь код перейдёт на `project_id`. Это заодно снимает
рассогласование типов между `staffing_demand.project` и
`staffing_demand_rows.project` (§4.3).

### Что сделать в коде

- `projectsRepo.ts`, `projects.types.ts`;
- `PortalContext`: `projects` вместо `CANDIDATE_PROJECTS`;
- панель управления проектами в Настройках (для `admin`);
- все выпадающие списки проектов — из `projects`.

### Критерии приёмки

- Новый проект, добавленный в Настройках, сразу доступен в фильтрах
  кандидатов и в модалке добавления потребности — без деплоя.
- Деактивированный проект исчезает из списков выбора, но исторические записи
  с ним отображаются корректно.

---

## ТЗ-13. Журнал изменений кандидатов

**Приоритет:** P1 · **Оценка:** 1.5 дня · **Аудит:** §4.5

### Цель

Распространить на кандидатов тот же аудит, что уже есть у потребности — с
персональными данными он нужнее.

### Миграция

По образцу `20260724130000_create_staffing_demand_history.sql`: таблица
`candidate_history`, `SECURITY DEFINER` триггер на `insert/update/delete`,
`select`-политика для `authenticated`, **без** `insert/update/delete` политик.

Хранить дифф изменённых полей в `jsonb` (у кандидата 20 колонок — колонка на
поле не масштабируется):

```sql
create table public.candidate_history (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null,
  action public.staffing_demand_history_action not null, -- переиспользуем enum
  changed_fields jsonb not null default '{}'::jsonb,     -- {"city": {"old": "Москва", "new": "Казань"}}
  changed_by uuid,
  changed_at timestamptz not null default now()
);

create index idx_candidate_history_candidate
  on public.candidate_history (candidate_id, changed_at desc);
```

Триггер пишет только реально изменившиеся поля (сравнение `to_jsonb(old)` и
`to_jsonb(new)`), иначе журнал будет забит шумом от `updated_at`.

### Что сделать в коде

- `candidateHistoryRepo.ts`;
- вкладка «История» в `RealCandidateDrawer` (переиспользовать разметку
  `DemandHistoryDrawer`);
- имя автора — join к `profiles` (доступно после ТЗ-05).

### Критерии приёмки

- Изменение города кандидата даёт одну запись в журнале с одним полем.
- В журнале видно имя сотрудника, а не UUID.
- Попытка вставить запись в журнал из браузера отклоняется (нет политики).

---

# Фаза 3. Масштаб и производительность

**Приоритет P1. Оценка: 6–8 дней.**

---

## ТЗ-14. Серверная выборка кандидатов

**Приоритет:** P1 · **Оценка:** 2.5 дня · **Аудит:** §6.3

### Цель

Перестать выгружать всю базу персональных данных в браузер. Задействовать
уже существующий trigram-индекс.

### Что сделать

1. `candidatesRepo.listCandidates` → принимает параметры:

```ts
export interface CandidateQuery {
  search?: string;
  project?: string;
  stage?: string;
  showArchived: boolean;
  sort: { field: "created_at" | "full_name" | "first_shift_at"; asc: boolean };
  page: number;
  pageSize: number;
}

export interface CandidatePage {
  rows: Candidate[];
  total: number; // из { count: "exact" }
}
```

2. Фильтры — в запросе: `.eq("project", …)`, `.is("archived_at", null)`,
   `.range(from, to)`, `.order(...)`, `{ count: "exact" }`.
3. Поиск — через RPC, чтобы задействовать GIN-индекс:

```sql
create function public.search_candidates(q text)
returns setof public.candidates
language sql stable security invoker as $$
  select * from public.candidates
  where full_name % q                       -- trigram, использует idx_candidates_full_name_trgm
     or phone ilike '%' || q || '%'
     or external_id ilike '%' || q || '%'
  order by similarity(full_name, q) desc
$$;
```

4. `candidateFilters.ts` — **не удалять**: оставить как чистую логику и как
   основу тестов, но в разделе использовать серверный путь. Метрики
   (`candidateMetrics.ts`) считать отдельным RPC-агрегатом, иначе они станут
   считаться по одной странице вместо всей выборки — **это обязательное
   требование**, иначе цифры на плитках изменят смысл.
5. Дебаунс поиска 300 мс.

### Критерии приёмки

- При 10 000 кандидатов первая отрисовка раздела запрашивает ≤ 50 строк
  (проверить во вкладке Network).
- Плитки метрик показывают значения по **всей** выборке, а не по странице.
- Поиск по части фамилии использует индекс (`explain analyze` показывает
  Bitmap Index Scan на `idx_candidates_full_name_trgm`).
- Существующие тесты `candidateFilters`/`candidateMetrics` остаются зелёными.

### Риски

Самое лёгкое место для регрессии смысла метрик. Зафиксировать ожидаемые числа
на тестовом наборе **до** изменений и сверить после.

---

## ТЗ-15. Разделение кода и URL у разделов

**Приоритет:** P1 · **Оценка:** 2 дня · **Аудит:** §3.2, §6.1

### Цель

Убрать 326 КБ справочника вакансий из общего бандла и дать разделам адреса.

### Что сделать

**Этап 1 — быстрая победа (0.5 дня):** динамические импорты в `PortalApp.tsx`
без изменения маршрутизации:

```ts
const VacanciesSection = dynamic(
  () => import("@/components/portal/sections/VacanciesSection")
    .then((m) => m.VacanciesSection),
  { loading: () => <SkeletonRows rows={8} /> },
);
```

Так же для `AnalyticsSection`, `MarketingSection`, `SettingsSection`. Это одно
изменение снимает большую часть из 1 274 КБ.

**Этап 2 — настоящие роуты (1.5 дня):** `src/app/(portal)/<section>/page.tsx`
для каждого раздела, общий `layout.tsx` с `PortalProvider` + `PortalShell`.
`activePage` вычисляется из `usePathname()`, `goto` → `router.push`.
Существующие query-параметры «Потребности» (`demandQueryParams.ts`)
сохраняются как есть.

### Критерии приёмки

- Крупнейший чанк после сборки — меньше 150 КБ; общий объём клиентского JS
  снижен минимум вдвое.
- `vacancyData` отсутствует в начальном чанке (проверить поиском строки
  `sourceSheet`).
- `/candidates` открывается напрямую, «Назад» в браузере переключает разделы.
- Существующие ссылки вида `/?section=demand&...` продолжают работать
  (редирект).

---

## ТЗ-16. Разделение контекста и мемоизация матрицы

**Приоритет:** P1 · **Оценка:** 2 дня · **Аудит:** §3.1, §6.2

### Цель

Прекратить перерисовку матрицы потребности при каждом тосте.

### Что сделать

1. Разбить `PortalContext` на независимые провайдеры, сохранив публичный API
   `usePortal()` как фасад (правило: не ломать вызывающий код):
   - `UiProvider` — тосты, уведомления, плотность, навигация, `contextAction`;
   - `CandidatesProvider`;
   - `DemandProvider` — `demandRows`, `demandWindow`, `demandRowMeta`;
   - `DirectoriesProvider` — справочники, проекты, профили.
2. Вынести доменную логику в хуки `useRealCandidates()`, `useDemand()`,
   `useListOptions()` — файлы `context/useDemand.ts` и т.д.
3. `React.memo` на `DemandProjectRow`, `DemandCityRow`, `DemandCell` со
   сравнением по значению ячейки.
4. Дебаунс синхронизации URL в `DemandSection` — 300 мс (§6.5).

### Критерии приёмки

- Показ тоста не вызывает ре-рендера `DemandMatrix` (проверить React DevTools
  Profiler: highlight updates).
- Редактирование одной ячейки перерисовывает одну ячейку, а не всю матрицу.
- Ввод символа в поиск не добавляет запись в history браузера чаще раза в
  300 мс.
- Все существующие тесты зелёные, `usePortal()` не изменил сигнатуру.

---

## ТЗ-17. Виртуализация матрицы и режимы Неделя/Месяц

**Приоритет:** P1 · **Оценка:** 2 дня · **Аудит:** §6.2, §7.9

### Цель

Сделать матрицу пригодной при десятках проектов и на мобильных устройствах.

### Что сделать

1. Реализовать заявленные, но отсутствующие режимы агрегации в
   `demandAggregate.ts`: `getWeekColumns()` и `getMonthColumns()` — сумма
   `planned_count` по неделе/месяцу. В режимах «Неделя»/«Месяц» ячейки
   доступны только для чтения (редактирование — в режиме «День»), это
   предотвращает неоднозначность распределения суммы по дням.
2. Виртуализация горизонтали (колонки дат) — рендерить только видимые
   ±5 колонок. Библиотеку не добавлять без необходимости: при sticky-колонке
   проекта достаточно расчёта по `scrollLeft` в существующем
   `useHorizontalScrollSync`.
3. Мобильный режим: при ширине < 640 px по умолчанию открывать «Неделю».

### Критерии приёмки

- Матрица 100 строк × 60 колонок прокручивается без просадок (профилировать в
  DevTools Performance, цель — стабильные 60 fps).
- Переключение День/Неделя/Месяц меняет колонки и сохраняется в URL.
- На телефоне матрица читаема без горизонтального скролла в режиме «Неделя».

---

## ТЗ-18. Мелкие победы производительности

**Приоритет:** P2 · **Оценка:** 0.5 дня · **Аудит:** §6.4, §6.6

### Что сделать

1. **Удалить `Geist` и `Geist_Mono`** из `layout.tsx` — портал их не
   использует (§6.4). Убрать `--font-sans`/`--font-mono` из `globals.css`.
2. Почистить `globals.css` от boilerplate `create-next-app`: блок
   `prefers-color-scheme` с `--background/--foreground` и `body { font-family:
   Arial }` конфликтуют с токенами портала (§7.3).
3. Заменить `<img>` на `next/image` в четырёх местах — снимает 4
   предупреждения lint. Либо, если оптимизация SVG не нужна, отключить правило
   точечно с комментарием-обоснованием.

### Критерии приёмки

- `npm run lint` — 0 предупреждений.
- В Network при загрузке нет запросов к `fonts.gstatic.com`.
- Внешний вид портала не изменился (сравнить скриншоты до/после).

---

# Фаза 4. Зрелость интерфейса

**Приоритет P1–P2. Оценка: 7–9 дней.**

---

## ТЗ-19. Доступность: модальные окна, дровер, таблицы

**Приоритет:** P1 · **Оценка:** 2 дня · **Аудит:** §7.2

### Что сделать

1. **`ui/Modal.tsx`**: `role="dialog"`, `aria-modal="true"`,
   `aria-labelledby` на заголовок, ловушка фокуса (Tab по кругу внутри),
   возврат фокуса на элемент-триггер при закрытии, блокировка прокрутки фона.
2. **`ui/Drawer.tsx`**: то же; `aria-label` вынести в проп (сейчас зашито
   «Карточка кандидата», хотя дровер переиспользуется для истории).
3. Общий хук `ui/useFocusTrap.ts` — один на оба компонента, не дублировать.
4. **`CandidatesTable`**: строку сделать доступной с клавиатуры —
   `tabIndex={0}`, `role="button"`, `onKeyDown` на Enter/Space,
   `aria-label` с ФИО.
5. **`DemandMatrix`**: навигация стрелками между ячейками, `role="grid"`,
   `aria-rowindex`/`aria-colindex`.
6. Проверить контрастность токенов: `--text-3: #98989d` на `--surface`
   даёт около 2.5:1 — **ниже нормы WCAG AA (4.5:1)**, а этим цветом набраны
   подписи в таблицах. Затемнить.

### Критерии приёмки

- Полный сценарий (вход → кандидаты → открыть карточку → изменить → сохранить
  → закрыть) проходится только с клавиатуры.
- Фокус не покидает открытую модалку по Tab и возвращается на триггер.
- Lighthouse Accessibility ≥ 95 на разделах «Кандидаты» и «Потребность».
- Все текстовые токены проходят 4.5:1.

---

## ТЗ-20. Тёмная тема

**Приоритет:** P2 · **Оценка:** 1.5 дня · **Аудит:** §7.3

### Что сделать

1. В `portal-tokens.css` продублировать всю палитру для
   `:root[data-theme="dark"]` и `@media (prefers-color-scheme: dark)` — сами
   компоненты уже используют только переменные, менять их не нужно.
2. Переключатель Светлая/Тёмная/Системная в Настройках → «Отображение»,
   рядом с существующей плотностью таблиц; сохранять в `profiles`.
3. Установка `data-theme` до первой отрисовки (inline-скрипт в `layout.tsx`),
   иначе будет вспышка светлой темы.
4. Отдельно проверить цветовые уровни ячеек матрицы (`--red-soft`,
   `--amber-soft`, `--green-soft`) — на тёмном фоне их нужно подбирать
   заново, а не инвертировать.

### Критерии приёмки

- Все разделы, модалки, дроверы и тосты читаемы в тёмной теме.
- Нет вспышки светлой темы при перезагрузке.
- Контраст в тёмной теме тоже ≥ 4.5:1.

---

## ТЗ-21. Конкурентное редактирование

**Приоритет:** P1 · **Оценка:** 2 дня · **Аудит:** §7.4

### Цель

Прекратить молчаливую потерю правок при одновременной работе двух сотрудников.

### Что сделать

1. **Карточка кандидата — оптимистическая блокировка.** Отправлять
   `updated_at`, который был при открытии, и добавить его в условие:

```ts
.update(patch).eq("id", id).eq("updated_at", loadedUpdatedAt).select().single()
```

   Если строк не вернулось — запись изменена кем-то другим: показать диалог
   «Данные изменены другим сотрудником» с выбором «Перезагрузить» /
   «Перезаписать».
2. **Матрица потребности — Realtime.** Подписка на изменения
   `staffing_demand` в окне дат через Supabase Realtime; чужие изменения
   применяются к `demandRows` и коротко подсвечиваются в матрице. Для ячейки
   «последний победил» приемлемо (значение атомарно), но пользователь должен
   это видеть.
3. Отписка при уходе с раздела и при смене окна дат — иначе утечка каналов.

### Критерии приёмки

- Две вкладки: изменение ячейки в одной появляется во второй без перезагрузки.
- Две вкладки: сохранение карточки кандидата после чужого изменения даёт
  диалог, а не тихую перезапись.

---

## ТЗ-22. Реестр кандидатов уровня продукта

**Приоритет:** P2 · **Оценка:** 2 дня · **Аудит:** §7.7, §7.5, §7.6

### Что сделать

1. Сортировка по колонкам (опирается на серверную сортировку из ТЗ-14).
2. Выбор видимых колонок, сохранение набора в `profiles`.
3. Массовые действия: выделение чекбоксами, массовая смена стадии, массовое
   архивирование — через один запрос `.in("id", ids)`.
4. Подтверждение архивирования (§7.5) и единая терминология: выбрать «Архив»
   **или** «Вышел» и применить везде — в фильтре, кнопке, метке в таблице и
   тосте.
5. Экспорт CSV — экспортировать всю отфильтрованную выборку, а не текущую
   страницу (после ТЗ-14 это отдельный запрос), и дать выбор колонок.
6. Ошибки — не только в исчезающем тосте (§7.6): для ошибок записи показывать
   постоянное сообщение в форме, с кнопкой «Повторить».

### Критерии приёмки

- Сортировка и фильтры сохраняются в URL и переживают перезагрузку.
- Массовое архивирование 100 кандидатов — один запрос, одно подтверждение.
- Ошибка сохранения остаётся на экране, пока пользователь её не закроет.

---

# Фаза 5. Готовность к эксплуатации

**Приоритет P1. Оценка: 4–5 дней.**

---

## ТЗ-23. CI

**Приоритет:** P1 · **Оценка:** 1 день · **Аудит:** §8.1, §8.5

### Что сделать

1. Добавить скрипты в `package.json`:

```json
"typecheck": "tsc --noEmit",
"test:rls": "vitest run --config vitest.rls.config.ts"
```

2. `.github/workflows/ci.yml` — на `pull_request` и `push` в `main`:
   `npm ci` → `typecheck` → `lint` → `test` → `build`; отдельная job с
   `supabase start` → `test:rls`.
3. Защита ветки `main`: запрет прямого push, обязательное прохождение CI.
4. Проверка, что миграции применяются на чистой базе:
   `supabase db reset` в CI.

### Критерии приёмки

- PR с падающим тестом или ошибкой типов нельзя влить.
- Сломанная миграция обнаруживается в CI, а не на бою.

---

## ТЗ-24. Мониторинг и границы ошибок

**Приоритет:** P1 · **Оценка:** 1.5 дня · **Аудит:** §8.3, §3.4

### Что сделать

1. Sentry (`@sentry/nextjs`) — клиент, сервер, middleware. **Обязательно**
   настроить `beforeSend`: вырезать ФИО, телефоны, Telegram, email из тел
   событий и из URL — иначе персональные данные утекут во внешний сервис.
2. `src/app/error.tsx` и `src/app/global-error.tsx`.
3. Границы ошибок вокруг каждого раздела в `PortalApp` — падение одного
   раздела не должно уносить весь портал.
4. Логировать в Sentry все ошибки репозиториев (сейчас они только всплывают
   тостом и исчезают).

### Критерии приёмки

- Исключение в разделе показывает сообщение об ошибке и кнопку «Обновить»,
  остальной портал работает.
- Тестовое событие доходит до Sentry.
- В событии Sentry нет ни одного персонального поля (проверить вручную на
  ошибке сохранения кандидата).

---

## ТЗ-25. Персональные данные: 152-ФЗ

**Приоритет:** P1 · **Оценка:** 2 дня · **Аудит:** §5.8, §4.5

### Цель

Закрыть минимальные требования к обработке персональных данных.

### Что сделать

1. **Журнал доступа к персональным данным.** Таблица `pii_access_log`
   (кто, какого кандидата, когда открыл). Писать при открытии карточки и при
   экспорте CSV. Запись — через `rpc` с `SECURITY DEFINER`, чтобы клиент не
   мог её пропустить.
2. **Политика хранения.** Согласовать срок; SQL-функция удаления/обезличивания
   архивных кандидатов старше N месяцев + запуск по расписанию (`pg_cron`).
3. **Экспорт и удаление по запросу субъекта** — функции выгрузки всех данных
   по кандидату и обезличивания.
4. Автовыход по бездействию (§5.7): 30 минут, с предупреждением за минуту.
5. Роль `viewer` не должна видеть телефон и Telegram — маскировать в таблице
   и карточке (доступ к полям регулируется на уровне представления, а не
   только UI).

### Критерии приёмки

- Открытие карточки кандидата оставляет запись в журнале доступа.
- Экспорт CSV логируется с числом выгруженных строк.
- Через 30 минут бездействия сессия завершается.
- `viewer` видит телефон в виде `+7 999 ***-**-67`.

### Риски

Требует юридического согласования (сроки хранения, объём журналирования).
Начать согласование параллельно с Фазой 1, не откладывать на конец.

---

## ТЗ-26. Документация и релиз

**Приоритет:** P2 · **Оценка:** 1 день · **Аудит:** §8.4

### Что сделать

1. Переписать `README.md`: что за продукт, стек, запуск, переменные
   окружения, ссылки на `docs/`. Сейчас там стоковый текст `create-next-app`,
   противоречащий `CLAUDE.md`.
2. Обновить `architecture/system.md` и `database/schema.md` под новую схему (профили, роли,
   проекты, журналы) — они станут неактуальны уже после Фазы 1.
3. `docs/OPERATIONS.md`: заведение сотрудника, назначение роли, отзыв
   доступа, восстановление из бэкапа, действия при инциденте.
4. Проверить и включить автоматические бэкапы Supabase (PITR), описать
   процедуру восстановления и **проверить её на практике** — непроверенный
   бэкап не считается бэкапом.
5. `changelog/CHANGELOG.md` — вести с 1.0.

---

# Фаза 6. После 1.0

Не блокирует релиз, зафиксировано, чтобы не потерять.

| Задача | Аудит |
|--------|-------|
| Удалить enum-колонки `project`, оставив только `project_id` | §4.2 |
| `updated_by` во всех таблицах | §4.7 |
| Убрать `getUser()` из middleware в пользу проверки JWT без сетевого вызова | §5.6 |
| Структура i18n | §7.9 |
| Реальные интеграции (1С, Telegram-бот) — вместо удалённых заглушек | §7.1 |
| Раздел «Маркетинг» на реальных данных по каналам | §7.1 |
| Уведомления на реальных событиях вместо `INITIAL_NOTIFICATIONS` | §7.1 |
| MFA для роли `admin` | §5.2 |
| Разбор `SettingsSection` на подкомпоненты | §3.5 |
| E2E-тесты (Playwright) на ключевые сценарии | §8.2 |

---

# Сводный план

| Фаза | Содержание | Оценка | Приоритет |
|------|-----------|--------|-----------|
| 0 | ТЗ-01…04 — экстренная безопасность | 2–3 дня | P0 |
| 1 | ТЗ-05…08 — идентичность и права | 8–12 дней | P0 |
| 2 | ТЗ-09…13 — данные вместо выдумки | 8–10 дней | P0 |
| 3 | ТЗ-14…18 — масштаб и производительность | 6–8 дней | P1 |
| 4 | ТЗ-19…22 — зрелость интерфейса | 7–9 дней | P1/P2 |
| 5 | ТЗ-23…26 — готовность к эксплуатации | 4–5 дней | P1 |
| | **Итого до 1.0** | **35–47 дней** | |

Порядок фаз менять не рекомендуется: Фаза 2 опирается на профили из Фазы 1,
Фаза 3 — на серверные политики из Фазы 1, Фаза 4 — на разделение контекста.

## Минимальный набор для первой продажи

Если нужно сократить объём до самого необходимого, минимальный набор —
**Фазы 0, 1, 2 плюс ТЗ-14, ТЗ-15, ТЗ-23, ТЗ-24** (≈25 дней). Остальное можно
выпускать итерациями после первой продажи, но не раньше: без прав, без
честных данных и без CI продукт продавать нельзя.

## Что проверять после каждого ТЗ

```bash
npx tsc --noEmit && npm run lint && npm run test && npm run build
```

Плюс, начиная с ТЗ-07: `npm run test:rls`. Плюс ручная проверка затронутого
экрана в браузере — правило проекта: не заявлять «работает», не увидев
результат.
