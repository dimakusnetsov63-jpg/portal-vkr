-- SEC-3: явные табличные GRANT'ы вместо неявного поведения платформы.
--
-- До этой миграции во всех 57 миграциях проекта не было ни одного
-- табличного GRANT — права выдавал event trigger Supabase Cloud при
-- CREATE TABLE (legacy-поведение auto_expose_new_tables). Схема молча
-- стояла на недокументированном поведении платформы, объявленном
-- устаревшим: флаг удаляется из CLI 30 октября 2026, и с этого момента
-- эфемерная база в CI перестанет получать права вовсе.
--
-- Почему это важнее, чем кажется: GRANT и RLS — независимые слои. Первый
-- решает, может ли роль вообще обратиться к таблице, второй — какие строки
-- она увидит. При отсутствии гранта PostgREST отвечает 403 с кодом 42501 —
-- тем же самым, что и при отказе RLS. Отличить «политика не пустила» от
-- «прав на таблицу нет» по ответу невозможно, поэтому забытый грант
-- выглядит как работающая защита. Проект уже почти наступил на это, см.
-- docs/ROLLOUT-rls-tests.md, раздел «Ловушка, из-за которой тесты могли бы
-- проходить впустую».
--
-- Baseline снят с боевой базы 13 августа 2026 (docs/tasks/backlog.md,
-- SEC-3): 21 таблица, привилегии везде полные — 16 таблиц данных доступны
-- anon/authenticated/service_role, 5 таблиц portal_* только service_role.
--
-- Эта миграция НЕ трогает ни одной политики RLS и ни одной функции: SEC-3
-- целиком про права Postgres.

-- 1. Снять всё лишнее -----------------------------------------------------
-- Циклом, а не перечислением: задача этой миграции — гарантировать, что не
-- осталось ни одной таблицы с неявно выданными правами. Перечисление
-- пропустило бы таблицу, добавленную между написанием и применением, то
-- есть ровно тот случай, ради которого всё и затевается. Права выдаются
-- ниже явно и поимённо.
--
-- service_role не трогается: это доверенная служебная роль, которая
-- обходит RLS и обслуживает фикстуры тестов. В бою у неё полный набор,
-- выданный платформой; ниже он подтверждается явно, чтобы эфемерная база
-- без auto_expose получила то же самое.
do $$
declare
  v_rel record;
begin
  for v_rel in
    select c.relname, c.relkind
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'S')
  loop
    execute format('revoke all on public.%I from anon, authenticated', v_rel.relname);
  end loop;
end;
$$;

-- Последовательность portal_login_attempts_id_seq была доступна
-- anon/authenticated, хотя сама portal_login_attempts от них закрыта с
-- 20260801100000: та миграция отозвала права у таблицы и не тронула
-- последовательность. Не эксплуатировалось (без доступа к таблице вставить
-- нечего, nextval лишь сжигает номера), но это ровно тот мусор, ради
-- которого права и делаются явными. Цикл выше её уже закрыл — строка ниже
-- оставлена как явное утверждение намерения, а не как повтор.
revoke all on public.portal_login_attempts_id_seq from anon, authenticated;

-- 2. Выдать необходимое роли authenticated --------------------------------
-- Состав привилегий выведен из фактического набора политик каждой таблицы,
-- а не назначен на глаз: право без политики бесполезно, политика без права
-- не работает. TRUNCATE / REFERENCES / TRIGGER / MAINTAIN не выдаются
-- нигде — приложение ими не пользуется, а TRUNCATE у роли, ходящей из
-- браузера, не нужен ни при каких обстоятельствах.
--
-- anon не получает ничего: политик для него нет ни на одной таблице, строк
-- он всё равно не увидит. Отсутствие гранта остаётся вторым рубежом на
-- случай, если однажды по недосмотру появится anon-политика.

-- Только чтение: пишут SECURITY DEFINER-триггеры, RLS их не касается.
grant select on public.staffing_demand_history to authenticated;
grant select on public.vacancy_history to authenticated;

-- Чтение и запись без удаления: soft-delete через archived_at / is_active.
grant select, insert, update on public.addresses to authenticated;
grant select, insert, update on public.candidates to authenticated;
grant select, insert, update on public.candidate_list_options to authenticated;
grant select, insert, update on public.staffing_demand_rows to authenticated;
grant select, insert, update on public.staffing_demand_imports to authenticated;
grant select, insert, update on public.vacancy_projects to authenticated;

-- Полный набор: у этих таблиц есть delete-политика.
grant select, insert, update, delete on public.address_demand_history to authenticated;
grant select, insert, update, delete on public.project_import_configs to authenticated;
grant select, insert, update, delete on public.rate_cards to authenticated;
grant select, insert, update, delete on public.rates to authenticated;
grant select, insert, update, delete on public.staffing_demand to authenticated;
grant select, insert, update, delete on public.vacancy_attachments to authenticated;
grant select, insert, update, delete on public.vacancy_fields to authenticated;
grant select, insert, update, delete on public.vacancy_sections to authenticated;

-- 3. Подтвердить права service_role ---------------------------------------
-- В боевой базе они уже есть (выданы платформой), здесь это no-op. Нужны
-- ради эфемерной базы в CI: после отключения auto_expose_new_tables она
-- строится только на миграциях, а фикстурам RLS-тестов нужен прямой доступ
-- к таблицам в обход политик — включая portal_users, куда тесты заводят
-- пользователей (portal_admin_create_user требует уже существующего head,
-- то есть для самой первой фикстуры непригодна).
--
-- Набор ограничен четырьмя DML-привилегиями: в бою у роли формально шире,
-- но расширять его этой миграцией незачем.
grant select, insert, update, delete on public.address_demand_history to service_role;
grant select, insert, update, delete on public.addresses to service_role;
grant select, insert, update, delete on public.candidate_list_options to service_role;
grant select, insert, update, delete on public.candidates to service_role;
grant select, insert, update, delete on public.project_import_configs to service_role;
grant select, insert, update, delete on public.rate_cards to service_role;
grant select, insert, update, delete on public.rates to service_role;
grant select, insert, update, delete on public.staffing_demand to service_role;
grant select, insert, update, delete on public.staffing_demand_history to service_role;
grant select, insert, update, delete on public.staffing_demand_imports to service_role;
grant select, insert, update, delete on public.staffing_demand_rows to service_role;
grant select, insert, update, delete on public.vacancy_attachments to service_role;
grant select, insert, update, delete on public.vacancy_fields to service_role;
grant select, insert, update, delete on public.vacancy_history to service_role;
grant select, insert, update, delete on public.vacancy_projects to service_role;
grant select, insert, update, delete on public.vacancy_sections to service_role;

-- Пять таблиц portal_* остаются доступными только service_role: anon и
-- authenticated закрыты циклом выше, как и было с 20260728120000. Работа с
-- ними идёт исключительно через SECURITY DEFINER-функции, которые сами
-- проверяют право вызывающего.
grant select, insert, update, delete on public.portal_users to service_role;
grant select, insert, update, delete on public.portal_sessions to service_role;
grant select, insert, update, delete on public.portal_audit_log to service_role;
grant select, insert, update, delete on public.portal_login_attempts to service_role;
grant select, insert, update, delete on public.portal_section_permissions to service_role;
