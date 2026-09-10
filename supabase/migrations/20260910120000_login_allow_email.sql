-- Логин может быть рабочей почтой ----------------------------------------
--
-- Учётки в компании заводят по почте (`hr39@outsourcing-kadrov.ru`), а
-- прежний формат (`^[a-z0-9._-]{3,32}$`) не пропускал ни «@», ни длину
-- больше 32 символов. Новый формат — то же короткое имя ИЛИ адрес почты;
-- домен необязателен. Общая длина ограничена отдельным условием: внутри
-- регулярного выражения с необязательной доменной частью её не задать.
--
-- Правило продублировано в `src/components/portal/sections/settings/userForm.ts`
-- (LOGIN_PATTERN + MIN/MAX_LOGIN_LENGTH) — менять надо в обоих местах.

alter table public.portal_users
  drop constraint portal_users_login_format;

alter table public.portal_users
  add constraint portal_users_login_format check (
    login ~ '^[a-z0-9._+-]{1,64}(@[a-z0-9-]+(\.[a-z0-9-]+)+)?$'
    and char_length(login) between 3 and 100
  );

/** Свободен ли логин — для проверки прямо во время ввода. */
create or replace function public.portal_admin_login_available(p_login text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_login text := lower(btrim(coalesce(p_login, '')));
begin
  perform public.portal_require_admin();

  if v_login !~ '^[a-z0-9._+-]{1,64}(@[a-z0-9-]+(\.[a-z0-9-]+)+)?$'
     or char_length(v_login) not between 3 and 100 then
    return false;
  end if;

  return not exists (select 1 from public.portal_users where login = v_login);
end;
$$;

create or replace function public.portal_admin_create_user(
  p_full_name text,
  p_login text,
  p_password text,
  p_role public.portal_user_role,
  p_projects text[],
  p_is_active boolean default true
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_admin public.portal_users := public.portal_require_admin();
  v_login text := lower(btrim(coalesce(p_login, '')));
  v_full_name text := btrim(coalesce(p_full_name, ''));
  v_user public.portal_users;
begin
  if v_login !~ '^[a-z0-9._+-]{1,64}(@[a-z0-9-]+(\.[a-z0-9-]+)+)?$'
     or char_length(v_login) not between 3 and 100 then
    raise exception 'Логин: 3–100 символов — латиница в нижнем регистре, цифры, точка, дефис, подчёркивание, плюс либо адрес рабочей почты'
      using errcode = '22023';
  end if;
  if exists (select 1 from public.portal_users where login = v_login) then
    raise exception 'Логин «%» уже занят', v_login using errcode = '23505';
  end if;
  if coalesce(array_length(p_projects, 1), 0) = 0 then
    raise exception 'Нужно выбрать хотя бы один проект' using errcode = '22023';
  end if;
  perform public.portal_assert_password(p_password);

  insert into public.portal_users (full_name, login, password_hash, role, projects, is_active)
  values (v_full_name, v_login, crypt(p_password, gen_salt('bf', 10)), p_role, p_projects, coalesce(p_is_active, true))
  returning * into v_user;

  insert into public.portal_audit_log (action, actor_id, actor_login, target_id, target_login, details)
  values (
    'user_created', v_admin.id, v_admin.login, v_user.id, v_user.login,
    jsonb_build_object('role', v_user.role, 'projects', to_jsonb(v_user.projects), 'is_active', v_user.is_active)
  );

  return public.portal_user_json(v_user);
end;
$$;
