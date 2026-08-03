-- Fixes a genuine bug found while testing H-6, unrelated to it:
-- portal_admin_set_user_active(uuid, boolean) has always failed with
-- `42804 column "action" is of type portal_audit_action but expression is
-- of type text` — every call, both activate and deactivate, for any user.
--
-- Root cause: `case when p_is_active then 'user_activated' else
-- 'user_deactivated' end` resolves its literal branches to `text` before
-- Postgres gets a chance to infer the target column's enum type from
-- INSERT context — unlike a bare string literal in the same position,
-- which Postgres resolves against the column type directly. The other
-- portal_admin_* functions insert bare literals (or a CASE with no ELSE
-- branch on a non-enum column) and don't have this problem — checked all
-- of them, this is the only occurrence of the pattern.
--
-- This function was apparently never actually exercised successfully in
-- production before — the "Отключить доступ" toggle in "Команда и роли"
-- has been broken since the function was created, and only surfaced now
-- because this is the first time a second (non-admin) account existed to
-- toggle.
--
-- Fix is a single explicit cast on the CASE expression; nothing else in
-- the function body changes.
create or replace function public.portal_admin_set_user_active(p_user_id uuid, p_is_active boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_admin public.portal_users := public.portal_require_admin();
  v_user public.portal_users;
begin
  if p_user_id = v_admin.id and not p_is_active then
    raise exception 'Нельзя отключить собственную учётную запись' using errcode = '23514';
  end if;

  select * into v_user from public.portal_users where id = p_user_id;
  if not found then
    raise exception 'Пользователь не найден' using errcode = 'P0002';
  end if;

  if v_user.role = 'head' and v_user.is_active and not p_is_active then
    if not exists (
      select 1 from public.portal_users
      where role = 'head' and is_active and id <> v_user.id
    ) then
      raise exception 'Нельзя отключить последнего активного руководителя' using errcode = '23514';
    end if;
  end if;

  update public.portal_users set is_active = p_is_active where id = p_user_id returning * into v_user;

  -- Отключение обрывает уже открытые сессии: пользователь теряет доступ
  -- сразу, а не когда истечёт его текущая сессия.
  if not p_is_active then
    update public.portal_sessions
    set revoked_at = now()
    where user_id = p_user_id and revoked_at is null;
  end if;

  insert into public.portal_audit_log (action, actor_id, actor_login, target_id, target_login)
  values (
    (case when p_is_active then 'user_activated' else 'user_deactivated' end)::public.portal_audit_action,
    v_admin.id, v_admin.login, v_user.id, v_user.login
  );

  return public.portal_user_json(v_user);
end;
$$;
