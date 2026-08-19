-- TASK-013, фаза B4: устойчивая личность проверяемого сотрудника (DATA-01).
--
-- До этой миграции `employee_name` записывался как есть, с обрезкой только
-- по краям (`btrim` в RPC). Пробел внутри — «Иванов  Иван» — давал вторую
-- строку в каждой сводке, потому что вся отчётность раздела группируется
-- именно по этому полю. Заметить такое расщепление в отчёте почти
-- невозможно: две строки с одинаковым на вид именем.
--
-- Делается три вещи.
--
-- 1. Нормализация при записи: края обрезаются, любые последовательности
--    пробельных символов внутри схлопываются в один пробел. То же самое для
--    `reviewer_name`.
--
-- 2. Инвариант в базе, а не только в RPC. CHECK-ограничение гарантирует,
--    что ненормализованное имя не появится и через service_role или ручную
--    правку в SQL Editor. Существующие строки нормализуются здесь же —
--    иначе ограничение не встанет.
--
-- 3. Автосвязка с учётной записью портала. У большинства сотрудников КЦ
--    учётки нет — поэтому `employee_user_id` остаётся необязательным, — но
--    там, где активный пользователь с таким же ФИО есть, ссылка
--    проставляется сама. Клиент этого сделать не может: `portal_users`
--    закрыта RLS полностью, а RPC работает как SECURITY DEFINER и читать
--    её вправе. Связка ставится только при **единственном** совпадении:
--    два одинаковых ФИО — повод не гадать, а оставить поле пустым.
--
-- Отчётность продолжает группировать по имени, а не по `employee_user_id`:
-- иначе проверки сотрудников без учётки (это большинство) выпали бы из
-- сводок. Ссылка нужна для будущих персональных экранов и для перехода на
-- «рекрутёр видит свои проверки», когда до него дойдут руки.

-- 1. Backfill: привести существующие значения к нормализованному виду.
update public.quality_reviews
set employee_name = regexp_replace(btrim(employee_name), '\s+', ' ', 'g')
where employee_name <> regexp_replace(btrim(employee_name), '\s+', ' ', 'g');

update public.quality_reviews
set reviewer_name = regexp_replace(btrim(reviewer_name), '\s+', ' ', 'g')
where reviewer_name <> regexp_replace(btrim(reviewer_name), '\s+', ' ', 'g');

-- 2. Инвариант. regexp_replace/btrim иммутабельны, поэтому годятся в CHECK.
alter table public.quality_reviews
  add constraint quality_reviews_employee_name_normalized
    check (employee_name = regexp_replace(btrim(employee_name), '\s+', ' ', 'g')),
  add constraint quality_reviews_reviewer_name_normalized
    check (reviewer_name = regexp_replace(btrim(reviewer_name), '\s+', ' ', 'g'));

comment on column public.quality_reviews.employee_name is
  'Проверяемый сотрудник. Нормализован (края обрезаны, пробелы внутри схлопнуты) — по этому полю группируется вся отчётность раздела, и расщепление на опечатке недопустимо. Подсказки — candidate_list_options (list_type = recruiter), тот же справочник, что «Рекрутер» у кандидатов.';
comment on column public.quality_reviews.employee_user_id is
  'Ссылка на учётную запись портала, если у сотрудника она есть. Проставляется автоматически в portal_save_quality_review при единственном совпадении по ФИО; у большинства сотрудников КЦ учётки нет, поэтому поле необязательное и в группировке отчётов не участвует.';

-- 3. RPC: нормализация + автосвязка.
create or replace function public.portal_save_quality_review(
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
  v_current_project text;
  v_status text := coalesce(nullif(p_payload ->> 'status', ''), 'completed');
  v_reviewer text;
  v_employee text;
  v_employee_user_id uuid := nullif(p_payload ->> 'employee_user_id', '')::uuid;
  v_matches uuid[];
  v_score jsonb;
  v_item public.quality_checklist_items%rowtype;
  v_group_scores jsonb := '{}'::jsonb;
  v_total numeric;
  v_has_critical boolean := false;
  v_missing integer;
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

  -- Доступ к проекту существующей строки проверяется отдельно (SEC-01).
  -- `for update` держит строку до конца транзакции — иначе между проверкой
  -- и записью её мог бы перенести кто-то ещё.
  if v_review_id is not null then
    select project into v_current_project
    from public.quality_reviews
    where id = v_review_id
    for update;

    if not found then
      raise exception 'Проверка не найдена' using errcode = 'P0002';
    end if;

    if not public.portal_has_project(v_current_project) then
      raise exception 'Нет доступа к проекту этой проверки' using errcode = '42501';
    end if;
  end if;

  -- Нормализация имён (B4). Схлопывание пробелов внутри, не только по краям.
  v_employee := regexp_replace(btrim(coalesce(p_payload ->> 'employee_name', '')), '\s+', ' ', 'g');
  if v_employee = '' then
    raise exception 'Не указан проверяемый сотрудник' using errcode = 'P0001';
  end if;

  select coalesce(nullif(p_payload ->> 'reviewer_name', ''), u.login, 'неизвестно')
  into v_reviewer
  from public.portal_users u
  where u.id = public.portal_current_user_id();

  v_reviewer := regexp_replace(
    btrim(coalesce(v_reviewer, nullif(p_payload ->> 'reviewer_name', ''), 'неизвестно')),
    '\s+', ' ', 'g'
  );

  -- Автосвязка с учётной записью: только при единственном совпадении по ФИО.
  -- Явно присланный employee_user_id имеет приоритет — интерфейс может знать
  -- точнее, чем совпадение строк.
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
      status = v_status
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

  -- Завершённая проверка обязана быть заполненной целиком (BUG-01).
  --
  -- Не требуют ответа: архивные пункты (их не показывают) и пункты блока,
  -- чей переключатель ответил «Нет» — блок выключен, и его проценты не
  -- считаются. «Не применимо» — полноценный ответ, а не пропуск.
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
  -- Округление только на выходе: итог считается по неокруглённым процентам
  -- блоков, как AVERAGE в исходном файле.
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
    'has_critical', v_has_critical,
    'employee_name', v_employee,
    'employee_user_id', v_employee_user_id
  );
end;
$$;

comment on function public.portal_save_quality_review(uuid, jsonb) is
  'Атомарно сохраняет проверку качества вместе с ответами и пересчитывает проценты по блокам и итог. Клиент присылает только баллы — итог всегда считает база. p_review_id = null создаёт новую проверку. Вид проверки берётся из шаблона; завершить проверку с незаполненными пунктами нельзя; обновление требует доступа и к текущему проекту строки, и к проекту из payload; имена нормализуются, а employee_user_id проставляется автоматически при единственном совпадении по ФИО с активной учётной записью.';
