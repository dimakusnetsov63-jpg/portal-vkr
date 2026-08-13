# Откат новой модели доступа (ADR-005, фазы A и C)

Скрипты отката для восьми миграций `20260811100000`…`20260811110300`,
применённых к боевой базе 11 августа 2026. Решение и его цена —
[`ADR-005`](architecture/decisions/ADR-005-access-control-v2.md), состав
миграций — [`database/migrations.md`](database/migrations.md).

**Почему это документ, а не миграция.** Файл в `supabase/migrations/`
подхватит `supabase db push` и откатит модель на следующем же выкате — то
есть «страховка» сработала бы сама, без просьбы. Тот же приём уже применён
к откату H-6: скрипт живёт в [`ROLLOUT-project-access.md`](ROLLOUT-project-access.md),
не в миграциях.

---

## Порядок обязателен: сначала C, потом A

Политики фазы C вызывают `portal_can_view_section`/`portal_can_edit_section`.
Если начать с фазы A, то `drop function` либо упадёт по зависимости, либо —
с `cascade` — **снесёт вместе с функциями все политики**, а таблица с
включённым RLS и без политик закрыта наглухо: портал перестанет видеть
данные вообще.

Скрипт фазы A ниже это проверяет сам и отказывается выполняться, если
политики фазы C ещё на месте. Но полагаться на проверку как на
единственную защиту не стоит — порядок всё равно нужно соблюдать.

---

## Шаг 1. Откат фазы C

C1–C3 откатываются повторным выполнением файлов с прежними определениями —
они написаны как `drop policy` + `create policy`, повторный запуск безопасен:

```bash
npx supabase db query --linked -f supabase/migrations/20260803140000_project_scoped_rls_policies.sql   # C1
npx supabase db query --linked -f supabase/migrations/20260805100500_vacancy_projects_rls_policies.sql # C3, политики
npx supabase db query --linked -f supabase/migrations/20260805100600_vacancy_projects_rpc.sql          # C3, три RPC
```

**C2 и C4 целиком выполнять нельзя** — их прежние определения лежат внутри
больших миграций, создающих таблицы (`20260728120000`, `20260807100300`,
`20260805110000`). Нужные куски выписаны здесь дословно.

### C2 — `candidate_list_options` и `address_demand_history`

```sql
drop policy "portal_select_candidate_list_options" on public.candidate_list_options;
drop policy "portal_insert_candidate_list_options" on public.candidate_list_options;
drop policy "portal_update_candidate_list_options" on public.candidate_list_options;

create policy "portal_select_candidate_list_options"
  on public.candidate_list_options for select to authenticated
  using (public.portal_can('candidates'));
create policy "portal_insert_candidate_list_options"
  on public.candidate_list_options for insert to authenticated
  with check (public.portal_can('settings'));
create policy "portal_update_candidate_list_options"
  on public.candidate_list_options for update to authenticated
  using (public.portal_can('settings'))
  with check (public.portal_can('settings'));

drop policy "portal_select_address_demand_history" on public.address_demand_history;
drop policy "portal_insert_address_demand_history" on public.address_demand_history;
drop policy "portal_update_address_demand_history" on public.address_demand_history;
drop policy "portal_delete_address_demand_history" on public.address_demand_history;

create policy "portal_select_address_demand_history"
  on public.address_demand_history for select to authenticated
  using (public.portal_can('demand') and public.portal_has_project(project));
create policy "portal_insert_address_demand_history"
  on public.address_demand_history for insert to authenticated
  with check (public.portal_can('addresses') and public.portal_can('settings') and public.portal_has_project(project));
create policy "portal_update_address_demand_history"
  on public.address_demand_history for update to authenticated
  using (public.portal_can('addresses') and public.portal_can('settings') and public.portal_has_project(project))
  with check (public.portal_can('addresses') and public.portal_can('settings') and public.portal_has_project(project));
create policy "portal_delete_address_demand_history"
  on public.address_demand_history for delete to authenticated
  using (public.portal_can('addresses') and public.portal_can('settings') and public.portal_has_project(project));
```

### C4 — таблицы импорта

Возвращает и прежние выражения, и прежнюю структуру: четыре политики
`project_import_configs` снова схлопываются в `select` + `for all`.
**Проектная изоляция при этом снимается** — то есть откат C4 заново
открывает пробел H-6 на этих двух таблицах.

```sql
drop policy "portal_select_project_import_configs" on public.project_import_configs;
drop policy "portal_insert_project_import_configs" on public.project_import_configs;
drop policy "portal_update_project_import_configs" on public.project_import_configs;
drop policy "portal_delete_project_import_configs" on public.project_import_configs;

create policy "portal_select_project_import_configs"
  on public.project_import_configs for select to authenticated
  using (public.portal_can('addresses') and public.portal_can('settings'));
create policy "portal_write_project_import_configs"
  on public.project_import_configs for all to authenticated
  using (public.portal_can('addresses') and public.portal_can('settings'))
  with check (public.portal_can('addresses') and public.portal_can('settings'));

drop policy "portal_select_staffing_demand_imports" on public.staffing_demand_imports;
drop policy "portal_insert_staffing_demand_imports" on public.staffing_demand_imports;
drop policy "portal_update_staffing_demand_imports" on public.staffing_demand_imports;

create policy "portal_select_staffing_demand_imports"
  on public.staffing_demand_imports for select to authenticated
  using (public.portal_can('addresses') and public.portal_can('settings'));
create policy "portal_insert_staffing_demand_imports"
  on public.staffing_demand_imports for insert to authenticated
  with check (public.portal_can('addresses') and public.portal_can('settings'));
create policy "portal_update_staffing_demand_imports"
  on public.staffing_demand_imports for update to authenticated
  using (public.portal_can('addresses') and public.portal_can('settings'))
  with check (public.portal_can('addresses') and public.portal_can('settings'));
```

После шага 1 проверить, что старых вызовов не осталось ни одного:

```sql
select count(*) as must_be_zero
from pg_policies
where schemaname = 'public'
  and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ 'portal_can_(view|edit)_section';
```

---

## Шаг 2. Откат фазы A

**Что теряется безвозвратно:** содержимое `portal_section_permissions`.
Если к моменту отката администратор уже правил права через интерфейс
(фаза E) или появились project-specific overrides, эти изменения исчезнут —
матрица вернётся к захардкоженной в `portal_role_sections()`. Снять копию
до отката: `select * from public.portal_section_permissions order by role, section;`

Значения `portal_users.all_projects` теряются вместе с колонкой.

Выполнять целиком, одним куском — порядок внутри важен: функции
восстанавливаются **до** удаления того, на что они ссылаются.

```sql
-- Откат фазы A новой модели доступа (ADR-005).
-- Требует уже выполненного отката фазы C — см. шаг 1.
begin;

-- 0. Защита от неверного порядка -----------------------------------------
-- Без неё drop function ниже либо упадёт по зависимости, либо (с cascade)
-- снесёт политики вместе с функциями, оставив таблицы с включённым RLS и
-- без единой политики — то есть закрытыми наглухо.
do $$
declare
  v_policies integer;
  v_functions integer;
begin
  select count(*) into v_policies
  from pg_policies
  where schemaname = 'public'
    and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ 'portal_can_(view|edit)_section';

  if v_policies > 0 then
    raise exception 'Сначала откатите фазу C: % политик всё ещё вызывают portal_can_view_section/portal_can_edit_section', v_policies;
  end if;

  -- Три RPC вакансий тоже переведены фазой C и обходят RLS, поэтому их
  -- проверка прав — самостоятельный гейт, а не дубль политик.
  select count(*) into v_functions
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname not in ('portal_can', 'portal_can_view_section', 'portal_can_edit_section')
    and p.prosrc ~ 'portal_can_(view|edit)_section';

  if v_functions > 0 then
    raise exception 'Сначала откатите фазу C: % функций всё ещё вызывают portal_can_view_section/portal_can_edit_section', v_functions;
  end if;
end;
$$;

-- 1. portal_role_sections — обратно на захардкоженный case ----------------
-- Дословно редакция 20260731100300_update_portal_role_sections_rates.sql:
-- immutable (не читает таблицу) и без security definer.
create or replace function public.portal_role_sections(p_role public.portal_user_role)
returns text[]
language sql
immutable
as $$
  select case p_role
    when 'head' then array[
      'overview', 'demand', 'addresses', 'candidates', 'vacancies', 'rates',
      'marketing', 'analytics', 'notifications', 'settings', 'users'
    ]
    when 'coordinator' then array[
      'overview', 'demand', 'addresses', 'candidates', 'vacancies', 'rates',
      'marketing', 'analytics', 'notifications', 'settings'
    ]
    when 'manager' then array[
      'overview', 'demand', 'addresses', 'candidates', 'vacancies', 'rates', 'notifications'
    ]
    when 'recruiter' then array['addresses', 'candidates', 'vacancies', 'rates', 'notifications']
  end;
$$;

comment on function public.portal_role_sections(public.portal_user_role) is
  'Матрица «роль → разделы». Дубль src/lib/auth/roles.ts — меняется всегда в обоих местах.';

-- 2. portal_can — обратно на собственную проверку -------------------------
-- Дословно редакция 20260728120000_portal_auth.sql: перестаёт быть
-- синонимом VIEW и снова сам ходит в portal_users.
create or replace function public.portal_can(p_section text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.portal_users u
    where u.id = public.portal_current_user_id()
      and u.is_active
      and p_section = any (public.portal_role_sections(u.role))
  );
$$;

comment on function public.portal_can(text) is
  'Есть ли у текущего пользователя доступ к разделу. Роль и активность читаются из portal_users, а не из JWT.';

-- 3. portal_has_project — убрать ветку all_projects -----------------------
-- Дословно редакция 20260803130000_project_access_functions.sql. Делать
-- ДО удаления колонки: иначе функция осталась бы ссылаться на несуществующее
-- поле и падала бы на первом же вызове (тело SQL-функции не отслеживается
-- зависимостями, поэтому Postgres такую ошибку не поймает заранее).
create or replace function public.portal_has_project(p_project text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.portal_users u
    where u.id = public.portal_current_user_id()
      and u.is_active
      and (u.role = 'head' or p_project = any (u.projects))
  );
$$;

comment on function public.portal_has_project(text) is
  'H-6: есть ли у текущего пользователя доступ к проекту p_project. head видит всегда (bypass), остальные роли — только если p_project есть в portal_users.projects. Используется в политиках RLS на таблицах с колонкой project.';

-- 4. Удалить функции фазы A ----------------------------------------------
-- Без cascade: если что-то на них ещё ссылается, пусть падает здесь, а не
-- уносит зависимые объекты молча.
drop function public.portal_can_view_section(text);
drop function public.portal_can_edit_section(text);

-- 5. Удалить колонку all_projects ----------------------------------------
alter table public.portal_users drop column all_projects;

comment on column public.portal_users.projects is
  'Проекты сотрудника — значения справочника candidate_list_options (list_type = project) как текст, без FK (список проектов расширяется независимо). Используется в RLS через portal_has_project(): роль видит только строки своих проектов. Роль head видит все проекты независимо от содержимого поля.';

-- 6. Удалить матрицу ------------------------------------------------------
-- Раньше, чем portal_section_order(): на неё опирается CHECK-ограничение
-- portal_section_permissions_section_known. Триггер и оба частичных
-- unique-индекса удаляются вместе с таблицей.
drop table public.portal_section_permissions;

drop function public.portal_section_order();

commit;
```

### Проверка после отката

```sql
select
  (select count(*) from information_schema.tables
    where table_schema = 'public' and table_name = 'portal_section_permissions')      as tbl_must_be_0,
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'portal_users'
      and column_name = 'all_projects')                                                as col_must_be_0,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('portal_can_view_section', 'portal_can_edit_section',
                        'portal_section_order'))                                       as fn_must_be_0,
  (select provolatile from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'portal_role_sections')                 as vol_must_be_i,
  array_to_string(public.portal_role_sections('head'), ',')                            as head_sections;
```

`head_sections` должен совпасть с `ROLE_PERMISSIONS.head` из
`src/lib/auth/roles.ts` — 11 разделов в порядке меню.

### История миграций

`supabase db query -f` не пишет в `supabase_migrations.schema_migrations`,
поэтому и удалять записи нужно вручную — иначе `db push` будет считать
восемь миграций применёнными и не накатит их повторно:

```sql
delete from supabase_migrations.schema_migrations
where version in (
  '20260811100000', '20260811100100', '20260811100200', '20260811100300',
  '20260811110000', '20260811110100', '20260811110200', '20260811110300'
);
```

### После отката в коде

- регенерировать `src/lib/supabase/database.types.ts` — иначе типы обещают
  таблицу и функции, которых больше нет;
- `roles.ts` трогать не нужно: фазы A и C его не меняли, он и остаётся
  источником правды для фронтенда.
