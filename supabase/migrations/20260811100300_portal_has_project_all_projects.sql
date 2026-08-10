-- portal_has_project() учитывает признак all_projects (фаза A).
--
-- Минимальное расширение функции H-6, не переписывание: обе существующие
-- ветки сохраняются буква в букву, добавляется одна новая.
--
--   роль head            → доступ ко всем проектам (bypass как был);
--   all_projects = true  → доступ ко всем проектам (новое);
--   иначе                → project = any (portal_users.projects), как было.
--
-- На поведение системы миграция не влияет: колонка all_projects добавлена
-- предыдущей миграцией со значением false для всех существующих
-- пользователей, а выставлять её пока нечем — интерфейс и RPC появятся в
-- фазах D/E. Проектная изоляция в остальном не меняется: список политик,
-- их выражения и portal_has_rate_card_project() (она делегирует сюда же)
-- не трогаются.

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
      and (
        u.role = 'head'
        or u.all_projects
        or p_project = any (u.projects)
      )
  );
$$;

comment on function public.portal_has_project(text) is
  'H-6: есть ли у текущего пользователя доступ к проекту p_project. head видит всегда (bypass), пользователь с all_projects = true — тоже; остальные — только если p_project есть в portal_users.projects. Используется в политиках RLS на таблицах с колонкой project.';
