-- Защита входа от перебора (C-3) и отказ от блокировки учётной записи (C-4).
-- Фаза 1 из трёх: только расширение возможностей, ничего не ломается.
--
-- Что было не так
-- ---------------
-- 1. C-3. `portal_login` выдан роли `anon`, ограничения частоты по источнику
--    нет. Каждый вызов выполняет bcrypt (cost 10, ~50–100 мс CPU на сервере
--    БД) и при неудаче вставляет строку в `portal_audit_log`. То есть аноним
--    мог одновременно нагружать процессор базы и неограниченно наращивать
--    журнал — перебирая даже НЕСУЩЕСТВУЮЩИЕ логины, для которых старый
--    счётчик не срабатывал вовсе.
-- 2. C-4. Счётчик «10 неудач за 15 минут» считался ПО ЛОГИНУ и возвращал
--    `throttled`. Логины не секрет (видны в «Команде и ролях», в журнале, в
--    подписях «кто изменил»), поэтому кто угодно мог отключить вход
--    конкретному сотруднику — в том числе руководителю, то есть лишить
--    портал администрирования.
--
-- Как теперь
-- ----------
-- Первичный ключ ограничения — ИСТОЧНИК (IP), а не идентификатор. Это и есть
-- то, что разрешает C-3 и C-4 одновременно: замедляется атакующий, а не
-- владелец учётки. Логин пишется только как сигнал для расследования и
-- обнаружения атак; блокирующим фактором он не является нигде.
--
-- Вместо блокировки — экспоненциально растущее окно отказа. Постоянного
-- состояния (`locked`, `locked_until`) нет намеренно: успешный вход просто
-- перестаёт попадать в счётчик неудач, и доступ восстанавливается сам.
--
-- Задержка реализована как ОТКАЗ с `retry_after`, а не через `pg_sleep`:
-- спящий вызов удерживал бы соединение с базой и слот serverless-функции,
-- то есть сам стал бы усилителем отказа в обслуживании.
--
-- Порядок выката (важно)
-- ----------------------
-- Фаза 1 (эта миграция) — добавляет роль, таблицу и новую сигнатуру;
--   `anon`-грант СОХРАНЯЕТСЯ, старый путь продолжает работать.
-- Фаза 2 (код) — сервер начинает подписывать JWT с role=portal_auth_caller
--   и передавать IP. Именно здесь защита включается фактически: до неё
--   `p_ip` приходит NULL и ограничение по источнику неактивно.
-- Фаза 3 (отдельная миграция) — `revoke execute ... from anon`. Точка
--   невозврата, выполняется только после подтверждённой фазы 2.
--
-- Между фазами 1 и 3 работают оба пути, откат бесплатен.

-- Хранилище попыток входа ----------------------------------------------
-- Отдельная таблица, а не `portal_audit_log`: у них разные сроки хранения и
-- разное назначение. Журнал — это события безопасности для чтения человеком;
-- эта таблица — технический счётчик с суточной ретенцией, который вправе
-- наполнять аноним.

create table public.portal_login_attempts (
  id bigint generated always as identity primary key,

  -- sha256 от IP. Хранить сырой адрес не нужно: для ограничения частоты
  -- достаточно сравнения на равенство.
  --
  -- ОГРАНИЧЕНИЕ, которое надо понимать: хеш без соли обратим для IPv4
  -- перебором всего адресного пространства. Это не анонимизация, а снижение
  -- ущерба: таблица полностью закрыта RLS, пишут в неё только SECURITY
  -- DEFINER функции, а строки живут сутки. Полноценная анонимизация
  -- потребовала бы секретной соли и механизма её хранения и ротации — это
  -- отдельное решение, а не деталь этой миграции.
  --
  -- NULL = источник неизвестен (вызов без p_ip). Такие строки в ограничении
  -- частоты не участвуют.
  ip_hash text,

  -- sha256 от нормализованного логина. ТОЛЬКО СИГНАЛ: по этому полю
  -- ничего не блокируется — см. заголовок про C-4. Нужно, чтобы отличить
  -- «перебор одной учётки» от «перебор словаря логинов».
  login_hash text not null,

  succeeded boolean not null,
  created_at timestamptz not null default now()
);

comment on table public.portal_login_attempts is
  'Технический счётчик попыток входа для ограничения частоты (C-3). Ретенция — сутки, чистится portal_purge_login_attempts(). Не заменяет portal_audit_log: там события для человека, здесь счётчик для машины.';
comment on column public.portal_login_attempts.ip_hash is
  'sha256 от IP; NULL = источник неизвестен, в ограничении не участвует. Без соли — обратим для IPv4 при утечке дампа, см. комментарий в миграции.';
comment on column public.portal_login_attempts.login_hash is
  'sha256 от логина. Только для расследований и обнаружения атак — блокирующим фактором НЕ является (иначе вернулась бы блокировка чужой учётки, C-4).';

-- Горячий путь ограничения: «сколько неудач с этого источника за окно».
create index portal_login_attempts_ip_idx
  on public.portal_login_attempts (ip_hash, created_at desc)
  where not succeeded and ip_hash is not null;

-- Обнаружение атаки на конкретную учётку.
create index portal_login_attempts_login_idx
  on public.portal_login_attempts (login_hash, created_at desc)
  where not succeeded;

-- Чистка по ретенции.
create index portal_login_attempts_created_idx
  on public.portal_login_attempts (created_at);

-- Та же модель доступа, что у остальных portal_*: RLS включён, политик нет,
-- гранты отозваны. Снаружи таблица недостижима ни на чтение, ни на запись.
alter table public.portal_login_attempts enable row level security;
revoke all on public.portal_login_attempts from anon, authenticated;

/**
 * Ретенция. Вызывать по расписанию (pg_cron) раз в час:
 *   select cron.schedule('portal-purge-login-attempts', '0 * * * *',
 *                        $$ select public.portal_purge_login_attempts() $$);
 * Расписание намеренно не заводится этой миграцией: включение pg_cron —
 * отдельное решение уровня проекта, а не побочный эффект правки входа.
 */
create function public.portal_purge_login_attempts(p_keep interval default interval '24 hours')
returns bigint
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_deleted bigint;
begin
  delete from public.portal_login_attempts where created_at < now() - p_keep;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke execute on function public.portal_purge_login_attempts(interval) from public;

-- Доверенная роль для серверных вызовов -------------------------------
-- PostgREST переключается на роль из claim `role` в JWT; чтобы это было
-- возможно, роль выдаётся `authenticator`. Роль не имеет НИ ОДНОГО гранта на
-- таблицы — только execute на три auth-функции ниже. Это сознательная
-- альтернатива service_role, который обошёл бы RLS на всей схеме ради права
-- вызвать одну функцию.

-- Блок сделан идемпотентным намеренно: `create role` падает, если роль уже
-- есть, и повторный прогон миграции после частичного сбоя упирался бы в это
-- вместо реальной причины. Тот же приём, что с pgcrypto в 20260728120000.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'portal_auth_caller') then
    create role portal_auth_caller nologin;
  end if;
end
$$;

comment on role portal_auth_caller is
  'Server-side trusted role for portal security-definer auth RPCs. No table grants.';

grant portal_auth_caller to authenticator;

-- Вход ------------------------------------------------------------------
-- Сигнатура меняется (добавлен p_ip), поэтому функция пересоздаётся, а не
-- заменяется через create or replace. Параметр со значением по умолчанию:
-- существующий код вызывает функцию тремя именованными аргументами и
-- продолжит работать до фазы 2.

drop function public.portal_login(text, text, text);

create function public.portal_login(
  p_login text,
  p_password text,
  p_user_agent text default null,
  p_ip text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_login text := lower(btrim(coalesce(p_login, '')));
  v_login_hash text;
  v_ip_hash text;
  v_user public.portal_users;
  v_found boolean;
  v_recent_failures integer := 0;
  v_last_failure timestamptz;
  v_cooldown_seconds integer;
  v_token text;
  v_session_id uuid;
  v_expires timestamptz;
begin
  if v_login = '' or coalesce(p_password, '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_credentials');
  end if;

  v_login_hash := encode(digest(v_login, 'sha256'), 'hex');
  v_ip_hash := case
    when coalesce(btrim(p_ip), '') = '' then null
    else encode(digest(btrim(p_ip), 'sha256'), 'hex')
  end;

  -- Ограничение частоты по ИСТОЧНИКУ. Окно наблюдения — 15 минут.
  -- До 10 неудач подряд пропускаем без задержки: обычная опечатка не должна
  -- мешать работе. Дальше окно отказа удваивается с каждой неудачей и
  -- упирается в потолок 15 минут.
  --
  -- При неизвестном источнике (p_ip не передан) ограничение не применяется:
  -- единый счётчик для всех «неизвестных» означал бы, что один атакующий
  -- закрывает вход всем сразу — та же ошибка, что блокировка по логину.
  if v_ip_hash is not null then
    select count(*), max(created_at)
    into v_recent_failures, v_last_failure
    from public.portal_login_attempts
    where ip_hash = v_ip_hash
      and not succeeded
      and created_at > now() - interval '15 minutes';

    if v_recent_failures >= 10 then
      -- least(..., 10) в показателе защищает от переполнения при большом
      -- числе попыток; потолок 900 секунд задаёт максимальное окно.
      v_cooldown_seconds := least(power(2, least(v_recent_failures - 9, 10))::integer, 900);

      if v_last_failure > now() - make_interval(secs => v_cooldown_seconds) then
        return jsonb_build_object(
          'ok', false,
          'reason', 'throttled',
          'retry_after', v_cooldown_seconds
        );
      end if;
    end if;
  end if;

  select * into v_user from public.portal_users where login = v_login;
  v_found := found;

  if not v_found or v_user.password_hash <> crypt(p_password, v_user.password_hash) then
    insert into public.portal_login_attempts (ip_hash, login_hash, succeeded)
    values (v_ip_hash, v_login_hash, false);

    -- В журнал пишем только попытки по СУЩЕСТВУЮЩЕМУ логину. Иначе перебор
    -- словаря несуществующих имён неограниченно наращивал бы portal_audit_log
    -- силами анонима — это и была вторая половина C-3. Счётчик выше при этом
    -- фиксирует такие попытки в любом случае, так что защита не слабеет.
    if v_found then
      insert into public.portal_audit_log (action, target_id, target_login, details)
      values (
        'login_failed', v_user.id, v_user.login,
        jsonb_build_object('login', v_login, 'reason', 'invalid_credentials')
      );
    end if;

    return jsonb_build_object('ok', false, 'reason', 'invalid_credentials');
  end if;

  if not v_user.is_active then
    insert into public.portal_login_attempts (ip_hash, login_hash, succeeded)
    values (v_ip_hash, v_login_hash, false);

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

  -- Успешная попытка тоже записывается: она не считается в лимите (в выборке
  -- выше стоит `not succeeded`), но нужна для расследований — по ней видно,
  -- чем закончилась серия неудач с того же источника.
  insert into public.portal_login_attempts (ip_hash, login_hash, succeeded)
  values (v_ip_hash, v_login_hash, true);

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

-- Гранты ----------------------------------------------------------------
-- `anon` СОХРАНЯЕТСЯ на всех трёх функциях: это фаза 1, старый путь должен
-- продолжать работать. Снимет его фаза 3, после подтверждения фазы 2.

revoke execute on function public.portal_login(text, text, text, text) from public;
grant execute on function public.portal_login(text, text, text, text) to anon, authenticated;
grant execute on function public.portal_login(text, text, text, text) to portal_auth_caller;

grant execute on function public.portal_session_context(text) to portal_auth_caller;
grant execute on function public.portal_logout(text) to portal_auth_caller;
