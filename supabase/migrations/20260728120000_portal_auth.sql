-- Встроенная система авторизации портала (TASK-004).
--
-- Заменяет Supabase Auth: учётные записи сотрудников создаются и управляются
-- из раздела «Настройки → Команда и роли», источник истины — таблицы этой
-- схемы. Supabase остаётся только базой и API.
--
-- Три таблицы:
--   portal_users     — учётные записи (логин + bcrypt-хеш пароля + роль);
--   portal_sessions  — активные сессии (хранится только sha256 от токена);
--   portal_audit_log — журнал действий администратора и входов.
--
-- Модель доступа к самим таблицам: RLS включён, политик нет вообще, гранты
-- отозваны. То есть напрямую (PostgREST) их не прочитать и не изменить ни
-- анониму, ни авторизованному пользователю — вся работа идёт через
-- SECURITY DEFINER функции ниже, которые сами решают, кому что можно.
-- Пароль поэтому физически не может уехать клиенту: нет ни одного пути,
-- возвращающего password_hash.

-- pgcrypto: crypt()/gen_salt('bf') — bcrypt, digest() — sha256 для токенов,
-- gen_random_bytes() — сами токены. На Supabase расширение обычно уже стоит
-- в схеме extensions; блок ниже делает миграцию идемпотентной и переносимой.
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pgcrypto') then
    if exists (select 1 from pg_namespace where nspname = 'extensions') then
      execute 'create extension pgcrypto with schema extensions';
    else
      execute 'create extension pgcrypto';
    end if;
  end if;
end
$$;

-- Роли -----------------------------------------------------------------
-- Список фиксированный: Руководитель / Координатор / Менеджер / Рекрутер.
-- В базе — латинские слаги, русские подписи живут в src/lib/auth/roles.ts.
create type public.portal_user_role as enum ('head', 'coordinator', 'manager', 'recruiter');

create type public.portal_audit_action as enum (
  'user_created',
  'user_updated',
  'user_role_changed',
  'user_password_changed',
  'user_activated',
  'user_deactivated',
  'login_success',
  'login_failed',
  'logout'
);

-- Таблицы --------------------------------------------------------------

create table public.portal_users (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  login text not null,
  password_hash text not null,
  role public.portal_user_role not null,
  projects text[] not null default '{}'::text[],
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz,
  constraint portal_users_full_name_length check (char_length(btrim(full_name)) between 2 and 120),
  -- Логин хранится только в нижнем регистре (нормализуется в функциях ниже),
  -- поэтому уникального индекса по самому полю достаточно — без lower().
  constraint portal_users_login_format check (login ~ '^[a-z0-9._-]{3,32}$'),
  constraint portal_users_projects_not_empty check (cardinality(projects) > 0)
);

create unique index portal_users_login_key on public.portal_users (login);
create index portal_users_active_idx on public.portal_users (is_active);

comment on table public.portal_users is
  'Учётные записи портала. Создаются только через интерфейс (Настройки → Команда и роли), физически не удаляются — только деактивируются через is_active.';
comment on column public.portal_users.password_hash is
  'bcrypt-хеш (pgcrypto crypt/gen_salt(''bf'')). Открытый пароль не хранится и не возвращается ни одной функцией.';
comment on column public.portal_users.projects is
  'Проекты сотрудника — значения enum candidate_project как текст, без FK (список проектов может расшириться независимо). Сейчас поле информационное: разграничения данных по проектам в RLS ещё нет.';

create table public.portal_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.portal_users(id) on delete cascade,
  token_hash text not null unique,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create index portal_sessions_user_idx on public.portal_sessions (user_id) where revoked_at is null;
create index portal_sessions_expires_idx on public.portal_sessions (expires_at);

comment on table public.portal_sessions is
  'Сессии портала. Хранится sha256 от токена, а не сам токен: утечка дампа таблицы не даёт войти. Срок жизни скользящий — 12 часов от последней активности.';

create table public.portal_audit_log (
  id uuid primary key default gen_random_uuid(),
  action public.portal_audit_action not null,
  actor_id uuid references public.portal_users(id) on delete set null,
  actor_login text,
  target_id uuid references public.portal_users(id) on delete set null,
  target_login text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index portal_audit_log_created_idx on public.portal_audit_log (created_at desc);
create index portal_audit_log_target_idx on public.portal_audit_log (target_id, created_at desc);
create index portal_audit_log_failed_login_idx on public.portal_audit_log (created_at desc)
  where action = 'login_failed';

comment on table public.portal_audit_log is
  'Журнал действий администратора и событий входа. actor_login/target_login — снимки на момент события: запись остаётся читаемой после переименования или удаления связанной учётки.';
comment on column public.portal_audit_log.details is
  'Произвольные детали события. Пароли сюда не пишутся никогда — только факт смены.';

create trigger trg_portal_users_set_updated_at
  before update on public.portal_users
  for each row
  execute function public.set_candidates_updated_at();

-- Доступ к таблицам ----------------------------------------------------
-- RLS включён, политик нет: значит доступ закрыт полностью. Гранты
-- отзываются отдельно, потому что Supabase раздаёт их новым таблицам в
-- public по умолчанию, и полагаться на одно только отсутствие политик —
-- лишний риск.
alter table public.portal_users enable row level security;
alter table public.portal_sessions enable row level security;
alter table public.portal_audit_log enable row level security;

revoke all on public.portal_users from anon, authenticated;
revoke all on public.portal_sessions from anon, authenticated;
revoke all on public.portal_audit_log from anon, authenticated;

-- Разрешения -----------------------------------------------------------

-- Значение claim'а из JWT текущего запроса. Портал подписывает JWT сам
-- (src/lib/auth/jwt.ts) тем же секретом, что проверяет PostgREST, поэтому
-- auth.uid() продолжает работать и триггеры аудита «Потребности» пишут
-- корректного автора без единой правки.
create function public.portal_jwt_claim(p_claim text)
returns text
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> p_claim;
$$;

create function public.portal_current_user_id()
returns uuid
language sql
stable
as $$
  select nullif(public.portal_jwt_claim('sub'), '')::uuid;
$$;

/** id сессии из claim'а sid — нужен, чтобы при смене пароля не разлогинить самого себя. */
create function public.portal_current_session_id()
returns uuid
language sql
stable
as $$
  select nullif(public.portal_jwt_claim('sid'), '')::uuid;
$$;

-- Матрица «роль → разделы». Дублируется в src/lib/auth/roles.ts: интерфейс
-- прячет недоступные разделы, база их закрывает по-настоящему. При изменении
-- матрицы правятся оба места — рассинхронизация не ловится ни типами, ни
-- тестами. Раздел `users` — не пункт меню, а право управлять учётными
-- записями.
create function public.portal_role_sections(p_role public.portal_user_role)
returns text[]
language sql
immutable
as $$
  select case p_role
    when 'head' then array[
      'overview', 'demand', 'candidates', 'vacancies',
      'marketing', 'analytics', 'notifications', 'settings', 'users'
    ]
    when 'coordinator' then array[
      'overview', 'demand', 'candidates', 'vacancies',
      'marketing', 'analytics', 'notifications', 'settings'
    ]
    when 'manager' then array['overview', 'demand', 'candidates', 'vacancies', 'notifications']
    when 'recruiter' then array['candidates', 'vacancies', 'notifications']
  end;
$$;

/**
 * Есть ли у текущего запроса доступ к разделу.
 *
 * Роль и активность читаются из таблицы, а не из JWT: поэтому смена роли и
 * деактивация действуют со следующего же запроса, без перевыпуска токена и
 * без повторного входа пользователя.
 */
create function public.portal_can(p_section text)
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

-- Служебные функции ----------------------------------------------------

/** Публичное представление учётки. Никогда не содержит password_hash. */
create function public.portal_user_json(p_user public.portal_users)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'id', p_user.id,
    'full_name', p_user.full_name,
    'login', p_user.login,
    'role', p_user.role,
    'projects', to_jsonb(p_user.projects),
    'is_active', p_user.is_active,
    'created_at', p_user.created_at,
    'updated_at', p_user.updated_at,
    'last_login_at', p_user.last_login_at
  );
$$;

create function public.portal_assert_password(p_password text)
returns void
language plpgsql
immutable
as $$
begin
  if p_password is null or char_length(p_password) < 8 then
    raise exception 'Пароль должен быть не короче 8 символов' using errcode = '22023';
  end if;
  if char_length(p_password) > 128 then
    raise exception 'Пароль не должен быть длиннее 128 символов' using errcode = '22023';
  end if;
end;
$$;

/** Текущий администратор или исключение. Роль проверяется по таблице, не по JWT. */
create function public.portal_require_admin()
returns public.portal_users
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_admin public.portal_users;
begin
  select * into v_admin
  from public.portal_users
  where id = public.portal_current_user_id();

  if not found or not v_admin.is_active or v_admin.role <> 'head' then
    raise exception 'Недостаточно прав для управления пользователями' using errcode = '42501';
  end if;

  return v_admin;
end;
$$;

-- Вход, сессия, выход --------------------------------------------------

/**
 * Проверка логина и пароля, создание сессии.
 *
 * Вызывается только серверным маршрутом /api/auth/login: возвращённый токен
 * кладётся в httpOnly-cookie и в браузерный JS не попадает.
 *
 * Ответ всегда jsonb, а не исключение: причина неудачи нужна интерфейсу
 * («учётная запись отключена» против «неверный логин или пароль»), но
 * различать их наружу можно только после успешной проверки пароля — иначе
 * форма входа превращается в способ узнать, какие логины существуют.
 */
create function public.portal_login(
  p_login text,
  p_password text,
  p_user_agent text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_login text := lower(btrim(coalesce(p_login, '')));
  v_user public.portal_users;
  v_found boolean;
  v_failed integer;
  v_token text;
  v_session_id uuid;
  v_expires timestamptz;
begin
  if v_login = '' or coalesce(p_password, '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_credentials');
  end if;

  -- Минимальная защита от перебора: функция доступна анониму, иначе форма
  -- входа не работала бы вовсе. Полноценная временная блокировка учётки —
  -- отдельная задача, здесь только потолок попыток на логин.
  select count(*) into v_failed
  from public.portal_audit_log
  where action = 'login_failed'
    and details ->> 'login' = v_login
    and created_at > now() - interval '15 minutes';

  if v_failed >= 10 then
    return jsonb_build_object('ok', false, 'reason', 'throttled');
  end if;

  select * into v_user from public.portal_users where login = v_login;
  v_found := found;

  if not v_found or v_user.password_hash <> crypt(p_password, v_user.password_hash) then
    insert into public.portal_audit_log (action, target_id, target_login, details)
    values (
      'login_failed',
      case when v_found then v_user.id end,
      v_login,
      jsonb_build_object('login', v_login, 'reason', 'invalid_credentials')
    );
    return jsonb_build_object('ok', false, 'reason', 'invalid_credentials');
  end if;

  if not v_user.is_active then
    insert into public.portal_audit_log (action, target_id, target_login, details)
    values ('login_failed', v_user.id, v_user.login, jsonb_build_object('login', v_login, 'reason', 'disabled'));
    return jsonb_build_object('ok', false, 'reason', 'disabled');
  end if;

  v_token := encode(gen_random_bytes(32), 'hex');
  v_expires := now() + interval '12 hours';

  insert into public.portal_sessions (user_id, token_hash, user_agent, expires_at)
  values (v_user.id, encode(digest(v_token, 'sha256'), 'hex'), left(p_user_agent, 400), v_expires)
  returning id into v_session_id;

  update public.portal_users set last_login_at = now() where id = v_user.id;

  insert into public.portal_audit_log (action, actor_id, actor_login, target_id, target_login)
  values ('login_success', v_user.id, v_user.login, v_user.id, v_user.login);

  return jsonb_build_object(
    'ok', true,
    'token', v_token,
    'session_id', v_session_id,
    'expires_at', v_expires,
    'user', public.portal_user_json(v_user)
  );
end;
$$;

/**
 * Кто стоит за токеном сессии — для middleware и серверных маршрутов.
 *
 * Заодно продлевает сессию: срок жизни скользящий, но запись в базу идёт не
 * чаще раза в 5 минут, чтобы каждая RSC-навигация не превращалась в UPDATE.
 */
create function public.portal_session_context(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_session public.portal_sessions;
  v_user public.portal_users;
begin
  if coalesce(p_token, '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'no_session');
  end if;

  select * into v_session
  from public.portal_sessions
  where token_hash = encode(digest(p_token, 'sha256'), 'hex');

  if not found or v_session.revoked_at is not null or v_session.expires_at <= now() then
    return jsonb_build_object('ok', false, 'reason', 'no_session');
  end if;

  select * into v_user from public.portal_users where id = v_session.user_id;

  -- Деактивированный пользователь теряет доступ немедленно: сессия сразу
  -- закрывается, а не просто перестаёт проходить проверку.
  if not found or not v_user.is_active then
    update public.portal_sessions set revoked_at = now() where id = v_session.id and revoked_at is null;
    return jsonb_build_object('ok', false, 'reason', 'disabled');
  end if;

  if v_session.last_seen_at < now() - interval '5 minutes' then
    update public.portal_sessions
    set last_seen_at = now(),
        expires_at = now() + interval '12 hours'
    where id = v_session.id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'session_id', v_session.id,
    'user', public.portal_user_json(v_user)
  );
end;
$$;

create function public.portal_logout(p_token text)
returns void
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_session public.portal_sessions;
  v_user public.portal_users;
begin
  if coalesce(p_token, '') = '' then
    return;
  end if;

  update public.portal_sessions
  set revoked_at = now()
  where token_hash = encode(digest(p_token, 'sha256'), 'hex')
    and revoked_at is null
  returning * into v_session;

  if not found then
    return;
  end if;

  select * into v_user from public.portal_users where id = v_session.user_id;

  insert into public.portal_audit_log (action, actor_id, actor_login, target_id, target_login)
  values ('logout', v_user.id, v_user.login, v_user.id, v_user.login);
end;
$$;

-- Управление пользователями -------------------------------------------
-- Вызывается из браузера напрямую (PostgREST RPC): право проверяется внутри
-- по auth.uid() из подписанного порталом JWT, подделать его нельзя.

create function public.portal_admin_list_users()
returns table (
  id uuid,
  full_name text,
  login text,
  role public.portal_user_role,
  projects text[],
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz,
  last_login_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.portal_require_admin();

  return query
    select u.id, u.full_name, u.login, u.role, u.projects,
           u.is_active, u.created_at, u.updated_at, u.last_login_at
    from public.portal_users u
    order by u.is_active desc, u.full_name;
end;
$$;

/** Свободен ли логин — для проверки прямо во время ввода. */
create function public.portal_admin_login_available(p_login text)
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

  if v_login !~ '^[a-z0-9._-]{3,32}$' then
    return false;
  end if;

  return not exists (select 1 from public.portal_users where login = v_login);
end;
$$;

create function public.portal_admin_create_user(
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
  if v_login !~ '^[a-z0-9._-]{3,32}$' then
    raise exception 'Логин: 3–32 символа, латиница в нижнем регистре, цифры, точка, дефис или подчёркивание'
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

create function public.portal_admin_update_user(
  p_user_id uuid,
  p_full_name text,
  p_role public.portal_user_role,
  p_projects text[]
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_admin public.portal_users := public.portal_require_admin();
  v_before public.portal_users;
  v_user public.portal_users;
begin
  select * into v_before from public.portal_users where id = p_user_id;
  if not found then
    raise exception 'Пользователь не найден' using errcode = 'P0002';
  end if;
  if coalesce(array_length(p_projects, 1), 0) = 0 then
    raise exception 'Нужно выбрать хотя бы один проект' using errcode = '22023';
  end if;
  -- Портал без единого действующего руководителя администрировать некому.
  if v_before.role = 'head' and p_role <> 'head' and v_before.is_active then
    if not exists (
      select 1 from public.portal_users
      where role = 'head' and is_active and id <> v_before.id
    ) then
      raise exception 'Нельзя снять роль руководителя с последнего активного руководителя' using errcode = '23514';
    end if;
  end if;

  update public.portal_users
  set full_name = btrim(coalesce(p_full_name, '')),
      role = p_role,
      projects = p_projects
  where id = p_user_id
  returning * into v_user;

  insert into public.portal_audit_log (action, actor_id, actor_login, target_id, target_login, details)
  values (
    'user_updated', v_admin.id, v_admin.login, v_user.id, v_user.login,
    jsonb_build_object(
      'full_name', v_user.full_name,
      'projects', to_jsonb(v_user.projects)
    )
  );

  if v_before.role <> v_user.role then
    insert into public.portal_audit_log (action, actor_id, actor_login, target_id, target_login, details)
    values (
      'user_role_changed', v_admin.id, v_admin.login, v_user.id, v_user.login,
      jsonb_build_object('from', v_before.role, 'to', v_user.role)
    );
  end if;

  return public.portal_user_json(v_user);
end;
$$;

create function public.portal_admin_set_user_active(p_user_id uuid, p_is_active boolean)
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
    case when p_is_active then 'user_activated' else 'user_deactivated' end,
    v_admin.id, v_admin.login, v_user.id, v_user.login
  );

  return public.portal_user_json(v_user);
end;
$$;

/**
 * Задать новый пароль. Действующий пароль администратору не показывается и
 * не проверяется: он его не знает и знать не должен.
 */
create function public.portal_admin_set_password(p_user_id uuid, p_password text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_admin public.portal_users := public.portal_require_admin();
  v_user public.portal_users;
begin
  perform public.portal_assert_password(p_password);

  update public.portal_users
  set password_hash = crypt(p_password, gen_salt('bf', 10))
  where id = p_user_id
  returning * into v_user;

  if not found then
    raise exception 'Пользователь не найден' using errcode = 'P0002';
  end if;

  -- Все прочие сессии пользователя закрываются. Своя (sid из JWT) остаётся —
  -- иначе смена собственного пароля выкидывала бы администратора из портала.
  update public.portal_sessions
  set revoked_at = now()
  where user_id = p_user_id
    and revoked_at is null
    and id is distinct from public.portal_current_session_id();

  insert into public.portal_audit_log (action, actor_id, actor_login, target_id, target_login)
  values ('user_password_changed', v_admin.id, v_admin.login, v_user.id, v_user.login);

  return public.portal_user_json(v_user);
end;
$$;

create function public.portal_admin_list_audit(p_limit integer default 50)
returns table (
  id uuid,
  action public.portal_audit_action,
  actor_login text,
  target_login text,
  details jsonb,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.portal_require_admin();

  return query
    select a.id, a.action, a.actor_login, a.target_login, a.details, a.created_at
    from public.portal_audit_log a
    order by a.created_at desc
    limit least(greatest(coalesce(p_limit, 50), 1), 200);
end;
$$;

/**
 * Первый администратор. Работает ровно один раз — пока в портале нет ни
 * одной учётной записи, — и никому не выдан по грантам: выполняется вручную
 * из SQL-редактора Supabase владельцем проекта. Так в репозиторий не
 * попадает дефолтный пароль, а обычное создание пользователей всё равно
 * остаётся только в интерфейсе портала.
 *
 *   select public.portal_bootstrap_admin('admin', 'Имя Фамилия', '<пароль>');
 */
create function public.portal_bootstrap_admin(
  p_login text,
  p_full_name text,
  p_password text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_login text := lower(btrim(coalesce(p_login, '')));
  v_user public.portal_users;
begin
  if exists (select 1 from public.portal_users) then
    raise exception 'Пользователи уже созданы — заводите новые через Настройки → Команда и роли'
      using errcode = '23505';
  end if;
  if v_login !~ '^[a-z0-9._-]{3,32}$' then
    raise exception 'Логин: 3–32 символа, латиница в нижнем регистре, цифры, точка, дефис или подчёркивание'
      using errcode = '22023';
  end if;
  perform public.portal_assert_password(p_password);

  -- Первому руководителю доступны все проекты, какие есть в enum на момент
  -- запуска: список ведётся отдельно от учёток и может пополняться.
  insert into public.portal_users (full_name, login, password_hash, role, projects, is_active)
  values (
    btrim(coalesce(p_full_name, '')), v_login, crypt(p_password, gen_salt('bf', 10)),
    'head',
    array(select unnest(enum_range(null::public.candidate_project))::text),
    true
  )
  returning * into v_user;

  insert into public.portal_audit_log (action, target_id, target_login, details)
  values ('user_created', v_user.id, v_user.login, jsonb_build_object('bootstrap', true, 'role', 'head'));

  return public.portal_user_json(v_user);
end;
$$;

-- Гранты на функции ----------------------------------------------------
-- Postgres по умолчанию выдаёт execute роли PUBLIC, поэтому сначала отзыв,
-- потом точечная выдача.

revoke execute on function public.portal_jwt_claim(text) from public;
revoke execute on function public.portal_current_user_id() from public;
revoke execute on function public.portal_current_session_id() from public;
revoke execute on function public.portal_role_sections(public.portal_user_role) from public;
revoke execute on function public.portal_can(text) from public;
revoke execute on function public.portal_user_json(public.portal_users) from public;
revoke execute on function public.portal_assert_password(text) from public;
revoke execute on function public.portal_require_admin() from public;
revoke execute on function public.portal_login(text, text, text) from public;
revoke execute on function public.portal_session_context(text) from public;
revoke execute on function public.portal_logout(text) from public;
revoke execute on function public.portal_admin_list_users() from public;
revoke execute on function public.portal_admin_login_available(text) from public;
revoke execute on function public.portal_admin_create_user(text, text, text, public.portal_user_role, text[], boolean) from public;
revoke execute on function public.portal_admin_update_user(uuid, text, public.portal_user_role, text[]) from public;
revoke execute on function public.portal_admin_set_user_active(uuid, boolean) from public;
revoke execute on function public.portal_admin_set_password(uuid, text) from public;
revoke execute on function public.portal_admin_list_audit(integer) from public;
revoke execute on function public.portal_bootstrap_admin(text, text, text) from public;

-- Нужны при проверке политик, поэтому доступны обеим ролям PostgREST.
grant execute on function public.portal_jwt_claim(text) to anon, authenticated;
grant execute on function public.portal_current_user_id() to anon, authenticated;
grant execute on function public.portal_current_session_id() to anon, authenticated;
grant execute on function public.portal_role_sections(public.portal_user_role) to anon, authenticated;
grant execute on function public.portal_can(text) to anon, authenticated;

-- Вход и проверка сессии выполняются до появления JWT — значит, анониму.
grant execute on function public.portal_login(text, text, text) to anon, authenticated;
grant execute on function public.portal_session_context(text) to anon, authenticated;
grant execute on function public.portal_logout(text) to anon, authenticated;

-- Управление пользователями: только для запроса с JWT, право проверяется внутри.
grant execute on function public.portal_admin_list_users() to authenticated;
grant execute on function public.portal_admin_login_available(text) to authenticated;
grant execute on function public.portal_admin_create_user(text, text, text, public.portal_user_role, text[], boolean) to authenticated;
grant execute on function public.portal_admin_update_user(uuid, text, public.portal_user_role, text[]) to authenticated;
grant execute on function public.portal_admin_set_user_active(uuid, boolean) to authenticated;
grant execute on function public.portal_admin_set_password(uuid, text) to authenticated;
grant execute on function public.portal_admin_list_audit(integer) to authenticated;

-- portal_user_json / portal_assert_password / portal_require_admin —
-- внутренние помощники, снаружи не вызываются: грантов нет намеренно.
-- portal_bootstrap_admin тоже без грантов: только владелец из SQL-редактора.

-- Политики данных под роли --------------------------------------------
-- До этой миграции все политики были `using (true)` для любого вошедшего.
-- Теперь доступ к таблице определяется разделом, к которому она относится,
-- то есть ролью пользователя. Проверка живёт в базе, а не только в
-- интерфейсе: прямой запрос к PostgREST мимо портала упирается в то же
-- ограничение.

drop policy "authenticated_select_candidates" on public.candidates;
drop policy "authenticated_insert_candidates" on public.candidates;
drop policy "authenticated_update_candidates" on public.candidates;

create policy "portal_select_candidates"
  on public.candidates for select to authenticated
  using (public.portal_can('candidates'));
create policy "portal_insert_candidates"
  on public.candidates for insert to authenticated
  with check (public.portal_can('candidates'));
create policy "portal_update_candidates"
  on public.candidates for update to authenticated
  using (public.portal_can('candidates'))
  with check (public.portal_can('candidates'));

-- Справочники подсказок читают все, у кого есть «Кандидаты»; правит их
-- только тот, у кого есть «Настройки».
drop policy "authenticated_select_candidate_list_options" on public.candidate_list_options;
drop policy "authenticated_insert_candidate_list_options" on public.candidate_list_options;
drop policy "authenticated_update_candidate_list_options" on public.candidate_list_options;

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

drop policy "authenticated_select_staffing_demand" on public.staffing_demand;
drop policy "authenticated_insert_staffing_demand" on public.staffing_demand;
drop policy "authenticated_update_staffing_demand" on public.staffing_demand;
drop policy "authenticated_delete_staffing_demand" on public.staffing_demand;

create policy "portal_select_staffing_demand"
  on public.staffing_demand for select to authenticated
  using (public.portal_can('demand'));
create policy "portal_insert_staffing_demand"
  on public.staffing_demand for insert to authenticated
  with check (public.portal_can('demand'));
create policy "portal_update_staffing_demand"
  on public.staffing_demand for update to authenticated
  using (public.portal_can('demand'))
  with check (public.portal_can('demand'));
-- Удаление по-прежнему доступно всем, у кого есть раздел «Потребность»:
-- это штатное действие в матрице, а не административная операция.
create policy "portal_delete_staffing_demand"
  on public.staffing_demand for delete to authenticated
  using (public.portal_can('demand'));

drop policy "authenticated_select_staffing_demand_rows" on public.staffing_demand_rows;
drop policy "authenticated_insert_staffing_demand_rows" on public.staffing_demand_rows;
drop policy "authenticated_update_staffing_demand_rows" on public.staffing_demand_rows;

create policy "portal_select_staffing_demand_rows"
  on public.staffing_demand_rows for select to authenticated
  using (public.portal_can('demand'));
create policy "portal_insert_staffing_demand_rows"
  on public.staffing_demand_rows for insert to authenticated
  with check (public.portal_can('demand'));
create policy "portal_update_staffing_demand_rows"
  on public.staffing_demand_rows for update to authenticated
  using (public.portal_can('demand'))
  with check (public.portal_can('demand'));

drop policy "authenticated_select_staffing_demand_history" on public.staffing_demand_history;

create policy "portal_select_staffing_demand_history"
  on public.staffing_demand_history for select to authenticated
  using (public.portal_can('demand'));
