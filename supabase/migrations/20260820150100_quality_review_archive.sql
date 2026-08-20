-- TASK-013, фаза B1 аудита (DATA-02): архивация проверки.
--
-- Что было. Ошибочно созданную проверку нельзя было ни удалить, ни спрятать:
-- ни `archived_at`, ни DELETE-политики, ни кнопки. Единственный выход —
-- отредактировать её во что-то осмысленное. Для раздела, где строки
-- создаются десятками в день, это означало мусор в средних навсегда:
-- проверка не того сотрудника, дубль, проверка по ошибочному лиду.
--
-- Архивация, а не удаление — по той же причине, что у «Адресов» и
-- «Кандидатов»: у проверки есть история (журнал правок C5, снимок
-- формулировок B2), и стирать её из-за опечатки в поле «сотрудник»
-- неправильно. Плюс архивацию видно в журнале, а удаление не оставляет
-- следов вообще.
--
-- **Главное в этой миграции — не колонка, а исключение из отчётности.**
-- Архивированная проверка, продолжающая влиять на средние, не решала бы
-- задачу вовсе: смысл действия именно в том, чтобы убрать ошибочную строку
-- из статистики. Поэтому обе отчётные функции получают
-- `archived_at is null`, а реестр — фильтр по умолчанию.
--
-- Запись идёт отдельной RPC, а не UPDATE'ом из браузера: у quality_reviews
-- нет и не будет UPDATE-гранта (ADR-006, иначе можно прислать любой
-- total_score). Заодно RPC пишет событие в журнал.

alter table public.quality_reviews
  add column archived_at timestamptz;

comment on column public.quality_reviews.archived_at is
  'Проверка убрана из работы и из отчётности. Архивация вместо удаления: у проверки есть журнал правок и снимок формулировок, терять их из-за ошибки ввода незачем. Все агрегаты и реестр по умолчанию учитывают только строки с archived_at is null.';

-- Индекс под основной сценарий реестра — активные проверки за период.
-- Частичный: архивных мало и смотрят их редко.
create index quality_reviews_active_date_idx
  on public.quality_reviews (review_date desc)
  where archived_at is null;

-- Архивация и восстановление ----------------------------------------------
create function public.portal_archive_quality_review(
  p_review_id uuid,
  p_archived boolean
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_review public.quality_reviews%rowtype;
  v_actor uuid := public.portal_current_user_id();
  v_actor_login text;
begin
  if not public.portal_can_edit_section('quality') then
    raise exception 'Недостаточно прав для архивации проверки' using errcode = '42501';
  end if;

  select * into v_review from public.quality_reviews where id = p_review_id for update;
  if not found then
    raise exception 'Проверка не найдена' using errcode = 'P0002';
  end if;

  -- Тот же проектный гейт, что и у сохранения (SEC-01): архивировать чужую
  -- проверку, зная её id, нельзя.
  if not public.portal_has_project(v_review.project) then
    raise exception 'Нет доступа к проекту этой проверки' using errcode = '42501';
  end if;

  -- Версию намеренно не спрашиваем и не двигаем. Архивация не переписывает
  -- содержимое проверки, поэтому конфликтовать с чьей-то открытой формой ей
  -- не с чем: та сохранит свои правки, проверка останется архивной.
  update public.quality_reviews
  set archived_at = case when p_archived then now() else null end
  where id = p_review_id;

  select login into v_actor_login from public.portal_users where id = v_actor;

  insert into public.portal_audit_log (action, actor_id, actor_login, details)
  values (
    case when p_archived then 'quality_review_archived' else 'quality_review_restored' end,
    v_actor,
    v_actor_login,
    jsonb_build_object(
      'review_id', p_review_id,
      'crm_lead_id', v_review.crm_lead_id,
      'employee_name', v_review.employee_name,
      'project', v_review.project,
      'total_score', v_review.total_score
    )
  );

  return jsonb_build_object('id', p_review_id, 'archived', p_archived);
end;
$$;

comment on function public.portal_archive_quality_review(uuid, boolean) is
  'Убирает проверку из работы и из отчётности (или возвращает обратно). Требует can_edit(quality) и доступа к проекту строки. Версию не спрашивает: архивация не переписывает содержимое и ничьей открытой формы не ломает. Пишет событие в portal_audit_log.';

revoke execute on function public.portal_archive_quality_review(uuid, boolean) from public;
grant execute on function public.portal_archive_quality_review(uuid, boolean) to authenticated;

-- Отчётность перестаёт видеть архивные -------------------------------------
-- Состав колонок не меняется, поэтому `create or replace` достаточно и
-- гранты сохраняются.
create or replace function public.portal_quality_report(
  p_from date,
  p_to date,
  p_project text default null,
  p_kind text default null
)
returns table (
  employee_name text,
  project text,
  reviews_count bigint,
  scored_count bigint,
  avg_total numeric,
  cases_count bigint,
  critical_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.employee_name,
    r.project,
    count(*) as reviews_count,
    count(*) filter (where r.total_score is not null) as scored_count,
    round(avg(r.total_score), 2) as avg_total,
    count(*) filter (where r.is_case) as cases_count,
    count(*) filter (where r.has_critical) as critical_count
  from public.quality_reviews r
  where public.portal_can_view_section('quality')
    and public.portal_has_project(r.project)
    and r.status = 'completed'
    and r.archived_at is null
    and r.review_date >= p_from
    and r.review_date <= p_to
    and (p_project is null or r.project = p_project)
    and (p_kind is null or r.kind = p_kind)
  group by r.employee_name, r.project
  order by r.employee_name, r.project;
$$;

create or replace function public.portal_quality_report_by_group(
  p_from date,
  p_to date,
  p_project text default null,
  p_kind text default null,
  p_employee text default null
)
returns table (
  employee_name text,
  group_id uuid,
  group_title text,
  group_sort_order integer,
  counts_in_total boolean,
  reviews_count bigint,
  scored_count bigint,
  avg_percent numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.employee_name,
    g.id as group_id,
    g.title as group_title,
    g.sort_order as group_sort_order,
    g.counts_in_total,
    count(*) as reviews_count,
    count(*) filter (where entry.value <> 'null'::jsonb) as scored_count,
    round(avg(nullif(entry.value, 'null'::jsonb)::numeric), 2) as avg_percent
  from public.quality_reviews r
  cross join lateral jsonb_each(r.group_scores) as entry(key, value)
  join public.quality_checklist_groups g on g.id = entry.key::uuid
  where public.portal_can_view_section('quality')
    and public.portal_has_project(r.project)
    and r.status = 'completed'
    and r.archived_at is null
    and r.review_date >= p_from
    and r.review_date <= p_to
    and (p_project is null or r.project = p_project)
    and (p_kind is null or r.kind = p_kind)
    and (p_employee is null or r.employee_name = p_employee)
  group by r.employee_name, g.id, g.title, g.sort_order, g.counts_in_total
  order by r.employee_name, g.sort_order;
$$;
