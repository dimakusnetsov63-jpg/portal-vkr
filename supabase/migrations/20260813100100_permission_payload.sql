-- Матрица прав уезжает клиенту вместе с пользователем (фаза D, ADR-005).
--
-- До этой миграции фронтенд определял права сам, из захардкоженного
-- ROLE_PERMISSIONS в src/lib/auth/roles.ts. Теперь права приходят с
-- сервера — из той же таблицы, на которую смотрит RLS, то есть источник
-- истины становится один. Само по себе это не механизм безопасности:
-- полученная клиентом матрица управляет только тем, что показывать, а
-- фактический доступ по-прежнему решают политики RLS.
--
-- Почему всё вносится в portal_user_json, а не в portal_login и
-- portal_session_context по отдельности: обе эти функции возвращают
-- пользователя через неё, поэтому одной правки достаточно для всех трёх
-- точек входа (login, session_context, admin_list_users). Альтернатива —
-- переписывать portal_login целиком, а в ней живёт ограничение частоты
-- входа по источнику (C-3/C-4); переносить эту логику руками ради одного
-- нового поля значило бы рисковать молча регрессировать security-фикс.

-- 1. «Все проекты» больше не требует фиктивного выбора проекта ------------
-- Прежнее ограничение (20260728120000) требовало непустой projects всегда.
-- С признаком all_projects (20260811100100) это противоречие: учётке,
-- которой доступны все проекты, всё равно пришлось бы выбрать один
-- конкретный. Защита от «завели сотрудника и забыли выдать проекты — он
-- не видит ничего» при этом сохраняется: пустой массив допустим только
-- вместе с явно поднятым флагом.
alter table public.portal_users
  drop constraint portal_users_projects_not_empty;

alter table public.portal_users
  add constraint portal_users_projects_not_empty
  check (all_projects or cardinality(projects) > 0);

-- 2. Матрица прав роли в виде объекта ------------------------------------
-- Форма ответа:
--   {"candidates": {"visible": true, "can_view": true, "can_edit": true}, ...}
--
-- Ключи — все разделы из portal_section_order(), включая недоступные роли
-- (у них все три флага false). Так фронтенду не нужно знать полный список
-- разделов отдельно и гадать, означает ли отсутствие ключа «нет права» или
-- «раздел не существует».
--
-- Читаются только строки с project is null — правила «для всех проектов
-- роли». Project-specific overrides (колонка project) в первой версии не
-- используются; когда появятся, эта функция получит второй аргумент, а не
-- поменяет форму ответа.
create function public.portal_role_permissions(p_role public.portal_user_role)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_object_agg(
      p.section,
      jsonb_build_object(
        'visible', p.visible,
        'can_view', p.can_view,
        'can_edit', p.can_edit
      )
    ),
    '{}'::jsonb
  )
  from public.portal_section_permissions p
  where p.role = p_role
    and p.project is null;
$$;

comment on function public.portal_role_permissions(public.portal_user_role) is
  'Матрица прав роли как объект {раздел: {visible, can_view, can_edit}} — то, что уезжает клиенту вместе с пользователем. Включает разделы со всеми флагами false, чтобы фронтенд не отличал «нет права» от «нет такого раздела». Только UX: фактический доступ решают политики RLS.';

grant execute on function public.portal_role_permissions(public.portal_user_role) to anon, authenticated;

-- 3. portal_user_json — плюс all_projects и permissions -------------------
-- Волатильность immutable → stable: функция теперь читает таблицу и не
-- вправе обещать неизменность результата. Ни один индекс и ни одно
-- ограничение на неё не опираются, где immutable было бы обязательным.
--
-- security definer добавлен по той же причине, что и у
-- portal_role_sections в 20260811100200: portal_section_permissions
-- закрыта RLS без политик. Практически функция и раньше вызывалась только
-- из SECURITY DEFINER-функций (грантов у неё нет и не появляется), но
-- полагаться на права вызывающего там, где читается закрытая таблица, —
-- хрупко.
--
-- Поля пользователя не меняются и не убираются: password_hash здесь не
-- было и не появляется.
create or replace function public.portal_user_json(p_user public.portal_users)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', p_user.id,
    'full_name', p_user.full_name,
    'login', p_user.login,
    'role', p_user.role,
    'projects', to_jsonb(p_user.projects),
    'all_projects', p_user.all_projects,
    'is_active', p_user.is_active,
    'created_at', p_user.created_at,
    'updated_at', p_user.updated_at,
    'last_login_at', p_user.last_login_at,
    'permissions', public.portal_role_permissions(p_user.role)
  );
$$;

comment on function public.portal_user_json(public.portal_users) is
  'Пользователь в виде JSON для ответов portal_login и portal_session_context. С фазы D включает all_projects и permissions (матрицу прав роли). Пароль не возвращается ни в каком виде.';

-- 4. portal_admin_list_users — те же поля -------------------------------
-- Единственная из трёх точек входа, которая portal_user_json НЕ использует:
-- она объявлена как `returns table` с явным перечислением колонок, поэтому
-- правка portal_user_json её не касается. Без этого блока список
-- пользователей отдавал бы объекты без all_projects и permissions, то есть
-- не соответствующие типу PortalUser в коде.
--
-- drop + create, а не create or replace: Postgres не позволяет менять
-- состав возвращаемых колонок у существующей функции. Гранты пересоздаются
-- следом — при удалении функции они пропадают вместе с ней.
drop function public.portal_admin_list_users();

create function public.portal_admin_list_users()
returns table (
  id uuid,
  full_name text,
  login text,
  role public.portal_user_role,
  projects text[],
  all_projects boolean,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz,
  last_login_at timestamptz,
  permissions jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.portal_require_admin();

  return query
    select u.id, u.full_name, u.login, u.role, u.projects, u.all_projects,
           u.is_active, u.created_at, u.updated_at, u.last_login_at,
           public.portal_role_permissions(u.role)
    from public.portal_users u
    order by u.is_active desc, u.full_name;
end;
$$;

comment on function public.portal_admin_list_users() is
  'Список учётных записей для «Команда и роли». С фазы D отдаёт all_projects и permissions — те же поля, что portal_user_json, чтобы обе точки входа описывались одним типом PortalUser. Матрица одинакова у всех пользователей одной роли: это плата за единый тип, а не за счёт полезных данных.';

revoke execute on function public.portal_admin_list_users() from public;
grant execute on function public.portal_admin_list_users() to authenticated;
