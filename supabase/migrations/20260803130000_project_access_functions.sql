-- H-6 (docs/AUDIT-2026-07-31.md), фаза A — аддитивная часть выката.
--
-- Эти функции пока никем не вызываются ни в одной политике — их появление
-- не меняет наблюдаемое поведение системы ни для одной роли. Использование
-- начинается в отдельной миграции (фаза C), после read-only аудита (фаза B).
--
-- Стиль намеренно повторяет public.portal_can(): один подзапрос к
-- portal_users (закрыта RLS для authenticated, поэтому security definer),
-- stable (не immutable — зависит от данных сессии/таблицы), тот же принцип
-- "роль и активность читаются из таблицы, а не из JWT", что уже описан для
-- portal_can в docs/database/policies.md.

-- Решение №1 (подтверждено): роль head видит все проекты — фильтр по
-- portal_users.projects к ней не применяется вовсе, поле остаётся
-- информационным для этой роли, как и сегодня.
create function public.portal_has_project(p_project text)
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

-- public.rates — единственная из проектных таблиц без собственной колонки
-- project (только rate_card_id, FK на rate_cards). Отдельная функция вместо
-- встраивания join в каждую из четырёх политик rates — не дублировать
-- выражение четыре раза.
create function public.portal_has_rate_card_project(p_rate_card_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.rate_cards rc
    where rc.id = p_rate_card_id
      and public.portal_has_project(rc.project)
  );
$$;

comment on function public.portal_has_rate_card_project(uuid) is
  'H-6: то же самое, что portal_has_project, но для public.rates — она хранит только rate_card_id, проект берётся из связанной public.rate_cards.';
