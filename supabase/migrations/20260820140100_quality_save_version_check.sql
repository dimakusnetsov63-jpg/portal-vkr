-- TASK-013, фаза B3 аудита (BUG-05), вторая половина: проверка версии при
-- сохранении.
--
-- Колонку завела предыдущая миграция; здесь функция начинает её читать.
-- Механизм и текст исключения (`version_conflict`) взяты у вакансий
-- (20260805100600) дословно — клиент отличает конфликт от прочих ошибок
-- именно по этой строке, и второй способ сигнализировать о том же был бы
-- лишней сущностью.
--
-- Версия обязательна **только при обновлении**: у создания её неоткуда
-- взять. Но если проверка обновляется, а версия не пришла — это отказ, а
-- не «пропустим проверку»: сохранение без версии и есть тихая перезапись
-- чужой работы, ради предотвращения которой всё затевалось.
--
-- `drop` + `create`, а не `create or replace`: у функции меняется список
-- аргументов, то есть `create or replace` завёл бы вторую перегрузку рядом
-- со старой, и PostgREST выбирал бы между ними по составу переданных
-- параметров — старую, без проверки версии, в том числе. Гранты при `drop`
-- теряются и выдаются заново.
--
-- Остальное тело не менялось: гейты SEC-01/SEC-02, полнота (BUG-01),
-- нормализация имени и автосвязка (B4), снимок формулировок (B2), расчёт
-- процентов и журнал (C5).

drop function if exists public.portal_save_quality_review(uuid, jsonb);

create function public.portal_save_quality_review(
  p_review_id uuid,
  p_payload jsonb,
  p_expected_version integer default null
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
  v_current_project text;
  v_current_version integer;
  v_before_status text;
  v_before_total numeric;
  v_before_scores jsonb := '{}'::jsonb;
  v_score_diff jsonb := '[]'::jsonb;
  v_actor uuid := public.portal_current_user_id();
  v_actor_login text;
  v_status text := coalesce(nullif(p_payload ->> 'status', ''), 'completed');
  v_reviewer text;
  v_employee text;
  v_employee_user_id uuid := nullif(p_payload ->> 'employee_user_id', '')::uuid;
  v_matches uuid[];
  v_score jsonb;
  v_item public.quality_checklist_items%rowtype;
  v_item_group public.quality_checklist_groups%rowtype;
  v_group_scores jsonb := '{}'::jsonb;
  v_total numeric;
  v_has_critical boolean := false;
  v_missing integer;
  v_details jsonb;
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

  select login into v_actor_login from public.portal_users where id = v_actor;

  -- Доступ к проекту существующей строки проверяется отдельно (SEC-01).
  -- `for update` держит строку до конца транзакции — иначе между проверкой
  -- и записью её мог бы перенести кто-то ещё. Заодно снимается состояние
  -- «до» для журнала.
  if v_review_id is not null then
    select project, status, total_score, version
    into v_current_project, v_before_status, v_before_total, v_current_version
    from public.quality_reviews
    where id = v_review_id
    for update;

    if not found then
      raise exception 'Проверка не найдена' using errcode = 'P0002';
    end if;

    if not public.portal_has_project(v_current_project) then
      raise exception 'Нет доступа к проекту этой проверки' using errcode = '42501';
    end if;

    -- B3: оптимистическая блокировка. Версия обязательна именно при
    -- обновлении: сохранение без неё — это и есть тихая перезапись чужой
    -- работы, а не мелкая небрежность вызывающего.
    if p_expected_version is null then
      raise exception 'Не указана версия проверки при обновлении' using errcode = 'P0001';
    end if;

    if v_current_version is distinct from p_expected_version then
      raise exception 'version_conflict' using errcode = 'P0001';
    end if;

    select coalesce(
             jsonb_object_agg(
               s.item_id::text,
               case when s.is_na then 'н/д'
                    when s.value is null then '—'
                    else s.value::text end
             ),
             '{}'::jsonb
           )
    into v_before_scores
    from public.quality_review_scores s
    where s.review_id = v_review_id;
  end if;

  -- Нормализация имён (B4). Схлопывание пробелов внутри, не только по краям.
  v_employee := regexp_replace(btrim(coalesce(p_payload ->> 'employee_name', '')), '\s+', ' ', 'g');
  if v_employee = '' then
    raise exception 'Не указан проверяемый сотрудник' using errcode = 'P0001';
  end if;

  select coalesce(nullif(p_payload ->> 'reviewer_name', ''), u.login, 'неизвестно')
  into v_reviewer
  from public.portal_users u
  where u.id = v_actor;

  v_reviewer := regexp_replace(
    btrim(coalesce(v_reviewer, nullif(p_payload ->> 'reviewer_name', ''), 'неизвестно')),
    '\s+', ' ', 'g'
  );

  -- Автосвязка с учётной записью: только при единственном совпадении по ФИО.
  if v_employee_user_id is null then
    select array_agg(u.id) into v_matches
    from public.portal_users u
    where u.is_active
      and regexp_replace(btrim(u.full_name), '\s+', ' ', 'g') = v_employee;

    if coalesce(array_length(v_matches, 1), 0) = 1 then
      v_employee_user_id := v_matches[1];
    end if;
  end if;

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
      -- Вид проверки — всегда вид шаблона (SEC-02).
      v_checklist.kind,
      (p_payload ->> 'crm_lead_id')::bigint,
      p_payload ->> 'project',
      v_employee,
      v_employee_user_id,
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
      v_status
    )
    returning id into v_review_id;
  else
    update public.quality_reviews set
      checklist_id = v_checklist.id,
      -- Версия НЕ переписывается на текущую: проверка остаётся привязанной
      -- к тому составу шаблона, по которому её заполняли изначально.
      kind = v_checklist.kind,
      crm_lead_id = (p_payload ->> 'crm_lead_id')::bigint,
      project = p_payload ->> 'project',
      employee_name = v_employee,
      employee_user_id = v_employee_user_id,
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
      status = v_status,
      version = version + 1
    where id = v_review_id;
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

    -- Блок отдельным запросом, а не вторым получателем в том же INTO:
    -- принадлежность пункта шаблону проверяется выше, а читаемость этой
    -- строки важнее одного сэкономленного обращения к кэшу.
    select g.* into v_item_group
    from public.quality_checklist_groups g
    where g.id = v_item.group_id;

    -- Снимок формулировки и положения пункта (B2): карточка проверки
    -- должна показывать то, что спрашивали тогда, а не то, как шаблон
    -- называется сейчас.
    insert into public.quality_review_scores (
      review_id, item_id, value, is_na, note,
      item_title, group_id, group_title, group_sort_order, item_sort_order
    )
    values (
      v_review_id,
      v_item.id,
      case when coalesce((v_score ->> 'is_na')::boolean, false) then null
           else nullif(v_score ->> 'value', '')::smallint end,
      coalesce((v_score ->> 'is_na')::boolean, false),
      nullif(v_score ->> 'note', ''),
      v_item.title,
      v_item_group.id,
      v_item_group.title,
      v_item_group.sort_order,
      v_item.sort_order
    );
  end loop;

  -- Завершённая проверка обязана быть заполненной целиком (BUG-01).
  if v_status = 'completed' then
    select count(*) into v_missing
    from public.quality_checklist_groups g
    join public.quality_checklist_items i
      on i.group_id = g.id and i.archived_at is null
    left join public.quality_review_scores s
      on s.item_id = i.id and s.review_id = v_review_id
    where g.checklist_id = v_checklist.id
      and g.archived_at is null
      and not exists (
        select 1
        from public.quality_checklist_items gate
        join public.quality_review_scores gs
          on gs.item_id = gate.id and gs.review_id = v_review_id
        where gate.group_id = g.id
          and gate.scale = 'yes_no'
          and gs.value = 0
      )
      and (s.review_id is null or (not s.is_na and s.value is null));

    if v_missing > 0 then
      raise exception 'Проверку нельзя завершить: не заполнено пунктов — %', v_missing
        using errcode = 'P0001';
    end if;
  end if;

  -- Расчёт ---------------------------------------------------------------
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

  -- Журнал (C5) ------------------------------------------------------------
  if p_review_id is null then
    insert into public.portal_audit_log (action, actor_id, actor_login, details)
    values (
      'quality_review_created', v_actor, v_actor_login,
      jsonb_build_object(
        'review_id', v_review_id,
        'crm_lead_id', (p_payload ->> 'crm_lead_id')::bigint,
        'employee_name', v_employee,
        'project', p_payload ->> 'project',
        'kind', v_checklist.kind,
        'status', v_status,
        'total_score', v_total
      )
    );
  else
    -- Разница по пунктам. `full outer join` — потому что ответ мог и
    -- исчезнуть: интерфейс присылает набор целиком, и снятая отметка
    -- выглядит как отсутствие ключа, а не как новое значение.
    with before_state as (
      select key as item_id, value as val from jsonb_each_text(v_before_scores)
    ), after_state as (
      select s.item_id::text as item_id,
             case when s.is_na then 'н/д'
                  when s.value is null then '—'
                  else s.value::text end as val
      from public.quality_review_scores s
      where s.review_id = v_review_id
    ), changed as (
      select coalesce(a.item_id, b.item_id) as item_id,
             coalesce(b.val, '—') as from_val,
             coalesce(a.val, '—') as to_val
      from after_state a
      full outer join before_state b on b.item_id = a.item_id
      where coalesce(b.val, '—') is distinct from coalesce(a.val, '—')
    )
    select coalesce(
             jsonb_agg(
               jsonb_build_object('item', coalesce(snap.item_title, i.title, c.item_id), 'from', c.from_val, 'to', c.to_val)
               order by coalesce(snap.group_sort_order, g.sort_order), coalesce(snap.item_sort_order, i.sort_order)
             ),
             '[]'::jsonb
           )
    into v_score_diff
    from changed c
    left join public.quality_review_scores snap
      on snap.review_id = v_review_id and snap.item_id = c.item_id::uuid
    left join public.quality_checklist_items i on i.id = c.item_id::uuid
    left join public.quality_checklist_groups g on g.id = i.group_id;

    insert into public.portal_audit_log (action, actor_id, actor_login, details)
    values (
      'quality_review_updated', v_actor, v_actor_login,
      jsonb_build_object(
        'review_id', v_review_id,
        'crm_lead_id', (p_payload ->> 'crm_lead_id')::bigint,
        'employee_name', v_employee,
        'project', p_payload ->> 'project',
        'scores', v_score_diff
      )
      -- Статус и итог попадают в запись только если менялись: иначе журнал
      -- заполнится строками «было 75, стало 75».
      || case when v_before_status is distinct from v_status
              then jsonb_build_object('status', jsonb_build_object('from', v_before_status, 'to', v_status))
              else '{}'::jsonb end
      || case when v_before_total is distinct from v_total
              then jsonb_build_object('total_score', jsonb_build_object('from', v_before_total, 'to', v_total))
              else '{}'::jsonb end
    );
  end if;

  return jsonb_build_object(
    'id', v_review_id,
    'total_score', v_total,
    'group_scores', v_group_scores,
    'has_critical', v_has_critical,
    'employee_name', v_employee,
    'employee_user_id', v_employee_user_id,
    'version', (select version from public.quality_reviews where id = v_review_id)
  );
end;
$$;

comment on function public.portal_save_quality_review(uuid, jsonb, integer) is
  'Атомарно сохраняет проверку качества вместе с ответами, пересчитывает проценты по блокам и итог и пишет событие в portal_audit_log. Клиент присылает только баллы — итог всегда считает база. p_review_id = null создаёт новую проверку. Вид проверки берётся из шаблона; завершить проверку с незаполненными пунктами нельзя; обновление требует доступа и к текущему проекту строки, и к проекту из payload; имена нормализуются, employee_user_id проставляется при единственном совпадении по ФИО. У правки в журнале фиксируется «было → стало» по каждому изменённому пункту. Обновление требует p_expected_version: несовпадение с текущей версией строки отвергается исключением version_conflict, вместо того чтобы затереть чужую правку.';

revoke execute on function public.portal_save_quality_review(uuid, jsonb, integer) from public;
grant execute on function public.portal_save_quality_review(uuid, jsonb, integer) to authenticated;
