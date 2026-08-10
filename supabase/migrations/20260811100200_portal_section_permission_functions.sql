-- Функции проверки прав поверх portal_section_permissions (фаза A).
--
-- Миграция аддитивная по наблюдаемому поведению: новые функции ещё никем
-- не вызываются, а две существующие (portal_can, portal_role_sections)
-- переписаны так, чтобы возвращать ровно то же самое, что и до неё —
-- baseline seed предыдущей миграции воспроизводит прежнюю матрицу один в
-- один (сверка: src/lib/auth/sectionPermissionsSeed.test.ts). Политики RLS
-- в этой миграции не трогаются вовсе.
--
-- Общий принцип у всех функций ниже — тот же, что был у portal_can с самого
-- начала: роль и активность читаются из portal_users в момент проверки, а
-- не из claim'ов JWT. Поэтому смена роли, отзыв права и деактивация
-- действуют со следующего же запроса, без перевыпуска токена. Права в JWT
-- не переносятся (это отдельное явное требование ТЗ).
--
-- Читаются только строки с project is null — правила «для всех проектов
-- роли». Project-specific overrides появятся позже; до тех пор строк с
-- ненулевым project в таблице нет вовсе.

-- VIEW: открыть раздел и читать данные ------------------------------------
create function public.portal_can_view_section(p_section text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.portal_users u
    join public.portal_section_permissions p
      on p.role = u.role
     and p.section = p_section
     and p.project is null
    where u.id = public.portal_current_user_id()
      and u.is_active
      and p.can_view
  );
$$;

comment on function public.portal_can_view_section(text) is
  'Может ли текущий пользователь открыть раздел и читать его данные. Используется в SELECT-политиках RLS. Роль и активность читаются из portal_users, а не из JWT.';

-- EDIT: изменять данные ---------------------------------------------------
create function public.portal_can_edit_section(p_section text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.portal_users u
    join public.portal_section_permissions p
      on p.role = u.role
     and p.section = p_section
     and p.project is null
    where u.id = public.portal_current_user_id()
      and u.is_active
      and p.can_edit
  );
$$;

comment on function public.portal_can_edit_section(text) is
  'Может ли текущий пользователь изменять данные раздела. Используется в INSERT/UPDATE/DELETE-политиках RLS. Проверять отдельно can_view не нужно: инвариант can_edit => can_view гарантирован CHECK-ограничением таблицы.';

-- Отдельной функции для VISIBLE намеренно нет: это признак интерфейса, а не
-- предикат доступа, и ни одна политика RLS его не проверяет. Значение
-- уезжает клиенту вместе с остальной матрицей в фазе D — там, где строится
-- меню. Заводить SQL-функцию, которую нельзя использовать как границу
-- безопасности, значило бы приглашать её туда, где нужна can_view.

-- Обратная совместимость --------------------------------------------------
-- portal_can остаётся синонимом VIEW. Все существующие политики продолжают
-- работать без единой правки, а фаза C переводит их на явные
-- portal_can_view_section/portal_can_edit_section по одной таблице за раз.
--
-- Важно: там, где portal_can('settings') сегодня используется как гейт на
-- запись (candidate_list_options, vacancy_*, импорт потребности), значение
-- не меняется — у head и coordinator раздел «Настройки» и виден, и
-- редактируем, у manager и recruiter отсутствует целиком.
create or replace function public.portal_can(p_section text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.portal_can_view_section(p_section);
$$;

comment on function public.portal_can(text) is
  'Синоним portal_can_view_section — сохранён ради существующих политик RLS, написанных до появления разделения VIEW/EDIT. В новых политиках используйте явные portal_can_view_section/portal_can_edit_section.';

-- portal_role_sections: контракт (имя, аргумент, тип возврата, порядок
-- элементов) сохранён полностью, изменилась только реализация — вместо
-- захардкоженного case читается матрица.
--
-- Два отличия от прежнего определения, оба вынужденные:
--   * stable вместо immutable — функция теперь читает таблицу, и обещать
--     неизменность результата для одного и того же аргумента она больше не
--     вправе. Ни одно ограничение и ни один индекс на неё не опираются
--     (immutable там было бы обязательным), так что смена волатильности
--     ничего не ломает;
--   * security definer — portal_section_permissions закрыта RLS без
--     политик, и без этого функция вернула бы пустой массив всем, кроме
--     владельца. Гранты у неё прежние (anon, authenticated): и до этой
--     миграции любой вызывающий мог получить список разделов любой роли,
--     новой утечки здесь не появляется.
--
-- Порядок элементов задаётся portal_section_order() — тем же, что и в меню,
-- то есть массивы совпадают с прежними побайтово, а не только по составу.
create or replace function public.portal_role_sections(p_role public.portal_user_role)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    array_agg(p.section order by array_position(public.portal_section_order(), p.section)),
    '{}'::text[]
  )
  from public.portal_section_permissions p
  where p.role = p_role
    and p.project is null
    and p.can_view;
$$;

comment on function public.portal_role_sections(public.portal_user_role) is
  'Разделы, доступные роли на чтение, в порядке меню. Читает portal_section_permissions (с 20260811100200; прежде — захардкоженный case). Сохранена ради обратной совместимости; новый код должен спрашивать portal_can_view_section/portal_can_edit_section про конкретный раздел.';

grant execute on function public.portal_section_order() to anon, authenticated;
grant execute on function public.portal_can_view_section(text) to anon, authenticated;
grant execute on function public.portal_can_edit_section(text) to anon, authenticated;
