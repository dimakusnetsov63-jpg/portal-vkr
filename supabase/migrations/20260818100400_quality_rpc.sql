-- TASK-013: RPC раздела «Контроль качества» — сохранение проверки и сводка.
--
-- Почему сохранение через функцию, а не обычным INSERT из PostgREST (как у
-- rate_cards/rates): проверка — это строка плюс N ответов плюс посчитанные
-- из них проценты. Тремя отдельными запросами это не атомарно, а главное —
-- итог оказался бы обычным полем, которому клиент присылает любое число.
-- Здесь клиент присылает только баллы; проценты считает база.
--
-- Формула воспроизводит исходный Excel дословно:
--   процент блока = сумма баллов / (2 × сумма весов зачтённых пунктов) × 100
--   итог          = среднее по блокам с counts_in_total = true
-- Блок «Возражения» заведён с counts_in_total = false и в итог не входит —
-- ровно как в файле, где итог считается как AVERAGE по остальным блокам.
--
-- Отличия от Excel, все сознательные:
--   * пункт «не применимо» исключается из знаменателя, а не считается
--     нулём (в файле это состояние выражалось пустой ячейкой и работало
--     случайно: SUM считает пустое нулём, AVERAGE — игнорирует);
--   * блок, у которого не осталось зачтённых пунктов либо переключатель
--     ответил «Нет», даёт NULL и в среднее не входит — вместо #DIV/0!;
--   * ноль по критическому пункту обнуляет итог. В засеянных из Excel
--     шаблонах критических пунктов нет, поэтому на перенесённой истории
--     правило не срабатывает.
--
-- SECURITY DEFINER — значит политики RLS обходятся, и право проверяется в
-- теле функции, как в portal_save_vacancy_project_tree.

-- Сохранение -------------------------------------------------------------
-- p_payload:
-- {
--   "checklist_id": uuid, "kind": "call"|"refusal",
--   "crm_lead_id": bigint, "project": text,
--   "employee_name": text, "employee_user_id": uuid|null,
--   "reviewer_name": text|null,          -- по умолчанию логин вызывающего
--   "review_date": date|null, "call_date": date|null,
--   "call_type": text|null, "position": text|null, "city": text|null,
--   "objection": text|null, "crm_comment": text|null,
--   "handling_speed": text|null, "outbound_calls": int|null,
--   "is_target": bool|null, "violation": text|null,
--   "recommendations": text|null,
--   "is_case": bool, "case_comment": text|null,
--   "status": "draft"|"completed",
--   "scores": [{"item_id": uuid, "value": 0|1|2|null, "is_na": bool, "note": text|null}]
-- }
create function public.portal_save_quality_review(
  p_review_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_review_id uuid := p_review_id;
  v_checklist_id uuid := nullif(p_payload ->> 'checklist_id', '')::uuid;
  v_checklist public.quality_checklists%rowtype;
  v_reviewer text;
  v_score jsonb;
  v_item public.quality_checklist_items%rowtype;
  v_group_scores jsonb := '{}'::jsonb;
  v_total numeric;
  v_has_critical boolean := false;
begin
  if not public.portal_can_edit_section('quality') then
    raise exception 'Недостаточно прав для сохранения проверки качества' using errcode = '42501';
  end if;

  select * into v_checklist from public.quality_checklists where id = v_checklist_id;
  if not found then
    raise exception 'Шаблон проверки не найден' using errcode = 'P0002';
  end if;
  if v_checklist.archived_at is not null then
    raise exception 'Шаблон проверки заархивирован' using errcode = 'P0001';
  end if;

  if not public.portal_has_project(p_payload ->> 'project') then
    raise exception 'Нет доступа к проекту' using errcode = '42501';
  end if;

  select coalesce(nullif(p_payload ->> 'reviewer_name', ''), u.login, 'неизвестно')
  into v_reviewer
  from public.portal_users u
  where u.id = public.portal_current_user_id();

  v_reviewer := coalesce(v_reviewer, nullif(p_payload ->> 'reviewer_name', ''), 'неизвестно');

  if v_review_id is null then
    insert into public.quality_reviews (
      checklist_id, checklist_version, kind, crm_lead_id, project,
      employee_name, employee_user_id, reviewer_name,
      review_date, call_date, call_type, position, city, objection,
      crm_comment, handling_speed, outbound_calls, is_target, violation,
      recommendations, is_case, case_comment, status
    ) values (
      v_checklist.id,
      v_checklist.version,
      coalesce(p_payload ->> 'kind', v_checklist.kind),
      (p_payload ->> 'crm_lead_id')::bigint,
      p_payload ->> 'project',
      btrim(p_payload ->> 'employee_name'),
      nullif(p_payload ->> 'employee_user_id', '')::uuid,
      v_reviewer,
      coalesce((p_payload ->> 'review_date')::date, current_date),
      (p_payload ->> 'call_date')::date,
      nullif(p_payload ->> 'call_type', ''),
      nullif(p_payload ->> 'position', ''),
      nullif(p_payload ->> 'city', ''),
      nullif(p_payload ->> 'objection', ''),
      nullif(p_payload ->> 'crm_comment', ''),
      nullif(p_payload ->> 'handling_speed', ''),
      nullif(p_payload ->> 'outbound_calls', '')::integer,
      nullif(p_payload ->> 'is_target', '')::boolean,
      nullif(p_payload ->> 'violation', ''),
      nullif(p_payload ->> 'recommendations', ''),
      coalesce((p_payload ->> 'is_case')::boolean, false),
      nullif(p_payload ->> 'case_comment', ''),
      coalesce(nullif(p_payload ->> 'status', ''), 'completed')
    )
    returning id into v_review_id;
  else
    update public.quality_reviews set
      checklist_id = v_checklist.id,
      -- Версия НЕ переписывается на текущую: проверка остаётся привязанной
      -- к тому составу шаблона, по которому её заполняли изначально.
      kind = coalesce(p_payload ->> 'kind', kind),
      crm_lead_id = (p_payload ->> 'crm_lead_id')::bigint,
      project = p_payload ->> 'project',
      employee_name = btrim(p_payload ->> 'employee_name'),
      employee_user_id = nullif(p_payload ->> 'employee_user_id', '')::uuid,
      reviewer_name = v_reviewer,
      review_date = coalesce((p_payload ->> 'review_date')::date, review_date),
      call_date = (p_payload ->> 'call_date')::date,
      call_type = nullif(p_payload ->> 'call_type', ''),
      position = nullif(p_payload ->> 'position', ''),
      city = nullif(p_payload ->> 'city', ''),
      objection = nullif(p_payload ->> 'objection', ''),
      crm_comment = nullif(p_payload ->> 'crm_comment', ''),
      handling_speed = nullif(p_payload ->> 'handling_speed', ''),
      outbound_calls = nullif(p_payload ->> 'outbound_calls', '')::integer,
      is_target = nullif(p_payload ->> 'is_target', '')::boolean,
      violation = nullif(p_payload ->> 'violation', ''),
      recommendations = nullif(p_payload ->> 'recommendations', ''),
      is_case = coalesce((p_payload ->> 'is_case')::boolean, false),
      case_comment = nullif(p_payload ->> 'case_comment', ''),
      status = coalesce(nullif(p_payload ->> 'status', ''), status)
    where id = v_review_id;

    if not found then
      raise exception 'Проверка не найдена' using errcode = 'P0002';
    end if;
  end if;

  -- Ответы переписываются целиком: снятый балл должен исчезать, а не
  -- оставаться от прошлого сохранения.
  delete from public.quality_review_scores where review_id = v_review_id;

  for v_score in select * from jsonb_array_elements(coalesce(p_payload -> 'scores', '[]'::jsonb))
  loop
    select i.* into v_item
    from public.quality_checklist_items i
    join public.quality_checklist_groups g on g.id = i.group_id
    where i.id = (v_score ->> 'item_id')::uuid
      and g.checklist_id = v_checklist.id;

    if not found then
      raise exception 'Пункт % не принадлежит шаблону проверки', v_score ->> 'item_id'
        using errcode = 'P0001';
    end if;

    insert into public.quality_review_scores (review_id, item_id, value, is_na, note)
    values (
      v_review_id,
      v_item.id,
      case when coalesce((v_score ->> 'is_na')::boolean, false) then null
           else nullif(v_score ->> 'value', '')::smallint end,
      coalesce((v_score ->> 'is_na')::boolean, false),
      nullif(v_score ->> 'note', '')
    );
  end loop;

  -- Расчёт ---------------------------------------------------------------
  -- Блок даёт NULL, если его переключатель ответил «Нет» либо не осталось
  -- ни одного зачтённого пункта с баллом.
  with per_group as (
    select
      g.id,
      g.counts_in_total,
      bool_or(i.scale = 'yes_no' and s.value = 0) as gate_closed,
      sum(case when i.scale <> 'yes_no' and not s.is_na and s.value is not null
               then s.value * i.weight end) as earned,
      sum(case when i.scale <> 'yes_no' and not s.is_na and s.value is not null
               then 2 * i.weight end) as maximum
    from public.quality_checklist_groups g
    join public.quality_checklist_items i on i.group_id = g.id
    join public.quality_review_scores s on s.item_id = i.id and s.review_id = v_review_id
    where g.checklist_id = v_checklist.id
    group by g.id, g.counts_in_total
  ), scored as (
    select
      id,
      counts_in_total,
      case when gate_closed or coalesce(maximum, 0) = 0
           then null
           else earned::numeric * 100 / maximum end as percent_raw
    from per_group
  )
  -- Округление только на выходе: итог считается по неокруглённым процентам
  -- блоков, как AVERAGE в исходном файле. Округли сначала — и итог поедет
  -- в третьем знаке относительно Excel на всей перенесённой истории.
  select
    coalesce(jsonb_object_agg(id::text, round(percent_raw, 2)), '{}'::jsonb),
    round(avg(percent_raw) filter (where counts_in_total and percent_raw is not null), 2)
  into v_group_scores, v_total
  from scored;

  select exists (
    select 1
    from public.quality_review_scores s
    join public.quality_checklist_items i on i.id = s.item_id
    where s.review_id = v_review_id
      and i.is_critical
      and s.value = 0
      and not s.is_na
  ) into v_has_critical;

  if v_has_critical then
    v_total := 0;
  end if;

  update public.quality_reviews
  set total_score = v_total,
      group_scores = v_group_scores,
      has_critical = v_has_critical
  where id = v_review_id;

  return jsonb_build_object(
    'id', v_review_id,
    'total_score', v_total,
    'group_scores', v_group_scores,
    'has_critical', v_has_critical
  );
end;
$$;

comment on function public.portal_save_quality_review(uuid, jsonb) is
  'Атомарно сохраняет проверку качества вместе с ответами и пересчитывает проценты по блокам и итог. Клиент присылает только баллы — итог всегда считает база. p_review_id = null создаёт новую проверку.';

-- Сводка -----------------------------------------------------------------
-- Агрегат в SQL, а не в браузере: за июнь 2026 в исходном файле 2765
-- проверок, за год их будут десятки тысяч. Раздел «Аналитика» до сих пор
-- заблокирован ровно из-за отсутствия серверных агрегаций — здесь эта
-- ошибка не повторяется.
--
-- Черновики (status = 'draft') в сводку не попадают: незаконченная
-- проверка не должна двигать средние.
create function public.portal_quality_report(
  p_from date,
  p_to date,
  p_project text default null,
  p_kind text default null
)
returns table (
  employee_name text,
  project text,
  reviews_count bigint,
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
    round(avg(r.total_score), 2) as avg_total,
    count(*) filter (where r.is_case) as cases_count,
    count(*) filter (where r.has_critical) as critical_count
  from public.quality_reviews r
  where public.portal_can_view_section('quality')
    and public.portal_has_project(r.project)
    and r.status = 'completed'
    and r.review_date >= p_from
    and r.review_date <= p_to
    and (p_project is null or r.project = p_project)
    and (p_kind is null or r.kind = p_kind)
  group by r.employee_name, r.project
  order by r.employee_name, r.project;
$$;

comment on function public.portal_quality_report(date, date, text, text) is
  'Сводка проверок за период: количество, средний итог, кейсы и критические ошибки по сотруднику и проекту. Право и проектная изоляция проверяются внутри запроса — функция SECURITY DEFINER и политики RLS обходит.';

revoke execute on function public.portal_save_quality_review(uuid, jsonb) from public;
revoke execute on function public.portal_quality_report(date, date, text, text) from public;

grant execute on function public.portal_save_quality_review(uuid, jsonb) to authenticated;
grant execute on function public.portal_quality_report(date, date, text, text) to authenticated;
