-- SEC-3: проверка модели прав. Падает с исключением при любом отклонении.
--
-- Запускается в CI после применения миграций:
--   npx supabase db query --local -f scripts/verify-grants.sql
--
-- Смысл проверки — не в том, что права «примерно правильные», а в том, что
-- они выданы **миграциями**, а не платформой. Пока эфемерная база получала
-- права от auto_expose_new_tables, RLS-тесты могли зеленеть по неверной
-- причине: отказ из-за отсутствия гранта неотличим от отказа RLS (оба —
-- 403/42501). Убрав автовыдачу, мы обязаны доказать, что ничего не забыто.
--
-- Безопасен для боевой базы: только чтение системных каталогов.
--
-- Строгость по ролям различается сознательно:
--   anon           — ничего и нигде. Проверяется точно.
--   authenticated  — ровно ожидаемый набор, ни больше ни меньше. Точно.
--   service_role   — доверенная служебная роль; проверяется, что нужный
--                    минимум есть. Шире (как в бою, где платформа выдала
--                    полный набор) — не ошибка.

do $$
declare
  v_expected constant jsonb := jsonb_build_object(
    'staffing_demand_history', 'SELECT',
    'vacancy_history',         'SELECT',
    'addresses',               'INSERT,SELECT,UPDATE',
    'candidates',              'INSERT,SELECT,UPDATE',
    'candidate_list_options',  'INSERT,SELECT,UPDATE',
    'staffing_demand_rows',    'INSERT,SELECT,UPDATE',
    'staffing_demand_imports', 'INSERT,SELECT,UPDATE',
    'vacancy_projects',        'INSERT,SELECT,UPDATE',
    'address_demand_history',  'DELETE,INSERT,SELECT,UPDATE',
    'project_import_configs',  'DELETE,INSERT,SELECT,UPDATE',
    'rate_cards',              'DELETE,INSERT,SELECT,UPDATE',
    'rates',                   'DELETE,INSERT,SELECT,UPDATE',
    'staffing_demand',         'DELETE,INSERT,SELECT,UPDATE',
    'vacancy_attachments',     'DELETE,INSERT,SELECT,UPDATE',
    'vacancy_fields',          'DELETE,INSERT,SELECT,UPDATE',
    'vacancy_sections',        'DELETE,INSERT,SELECT,UPDATE'
  );
  v_problem text;
  v_problems text[] := array[]::text[];
  v_count integer;
begin
  -- 1. anon не имеет прав ни на одну таблицу и ни на одну последовательность.
  for v_problem in
    select format('anon имеет %s на %s.%s', x.privilege_type, c.relkind, c.relname)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join aclexplode(c.relacl) x on true
    join pg_roles r on r.oid = x.grantee
    where n.nspname = 'public' and c.relkind in ('r', 'S') and r.rolname = 'anon'
  loop
    v_problems := array_append(v_problems, v_problem);
  end loop;

  -- 2. authenticated не имеет прав на последовательности.
  for v_problem in
    select format('authenticated имеет %s на последовательность %s', x.privilege_type, c.relname)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join aclexplode(c.relacl) x on true
    join pg_roles r on r.oid = x.grantee
    where n.nspname = 'public' and c.relkind = 'S' and r.rolname = 'authenticated'
  loop
    v_problems := array_append(v_problems, v_problem);
  end loop;

  -- 3. authenticated: фактический набор совпадает с ожидаемым.
  --    Ловит и лишнее (TRUNCATE, доступ к portal_*), и недостающее.
  for v_problem in
    with actual as (
      select c.relname as tbl, string_agg(distinct x.privilege_type, ',' order by x.privilege_type) as privs
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      join aclexplode(c.relacl) x on true
      join pg_roles r on r.oid = x.grantee
      where n.nspname = 'public' and c.relkind = 'r' and r.rolname = 'authenticated'
      group by c.relname
    ),
    expected as (
      select key as tbl, value as privs from jsonb_each_text(v_expected)
    )
    select format('authenticated на %s: ожидалось [%s], фактически [%s]',
                  coalesce(a.tbl, e.tbl), coalesce(e.privs, '(ничего)'), coalesce(a.privs, '(ничего)'))
    from actual a
    full outer join expected e on e.tbl = a.tbl
    where coalesce(a.privs, '') is distinct from coalesce(e.privs, '')
  loop
    v_problems := array_append(v_problems, v_problem);
  end loop;

  -- 4. service_role: нужный минимум есть на всех 21 таблице.
  for v_problem in
    select format('service_role на %s: не хватает [%s]', c.relname,
                  array_to_string(array(
                    select p from unnest(array['SELECT','INSERT','UPDATE','DELETE']) p
                    where not exists (
                      select 1 from aclexplode(c.relacl) x
                      join pg_roles r on r.oid = x.grantee
                      where r.rolname = 'service_role' and x.privilege_type = p
                    )
                  ), ', '))
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and exists (
        select 1 from unnest(array['SELECT','INSERT','UPDATE','DELETE']) p
        where not exists (
          select 1 from aclexplode(c.relacl) x
          join pg_roles r on r.oid = x.grantee
          where r.rolname = 'service_role' and x.privilege_type = p
        )
      )
  loop
    v_problems := array_append(v_problems, v_problem);
  end loop;

  -- 5. Ожидаемый список покрывает все таблицы, которым положены права.
  --    Новая таблица данных без строки в v_expected — это забытый грант,
  --    то есть ровно та ошибка, ради которой проверка и написана.
  select count(*) into v_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and c.relname not like 'portal_%'
    and not (v_expected ? c.relname);

  if v_count > 0 then
    v_problems := array_append(
      v_problems,
      format('таблиц данных вне ожидаемого списка: %s — добавьте GRANT в миграцию и строку в этот скрипт', v_count)
    );
  end if;

  if array_length(v_problems, 1) > 0 then
    raise exception E'Модель прав нарушена (SEC-3):\n  %', array_to_string(v_problems, E'\n  ');
  end if;

  raise notice 'SEC-3: модель прав в порядке';
end;
$$;
