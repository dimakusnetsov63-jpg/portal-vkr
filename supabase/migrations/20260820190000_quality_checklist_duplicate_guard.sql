-- Понятная ошибка при попытке завести второй действующий шаблон на ту же
-- пару «вид проверки + проект».
--
-- Ограничение существует с самого начала (частичные уникальные индексы
-- quality_checklists_kind_project_key и _kind_common_key, миграция
-- 20260818100100) и по делу: подбор шаблона обязан быть однозначным, иначе
-- «шаблон проекта» перестанет что-либо значить. Но до появления редактора
-- нарушить его было неоткуда — шаблоны заводились миграциями. Теперь это
-- рядовая пользовательская ошибка, и вместо
-- «duplicate key value violates unique constraint
-- "quality_checklists_kind_project_key"» человек должен прочитать, что
-- именно он сделал не так.
--
-- Проверка стоит до вставки и до обновления, а не отловом исключения:
-- перехватывать unique_violation значило бы полагаться на то, что оно
-- возникло именно по этой причине. Сам индекс остаётся на месте — он и есть
-- настоящая гарантия, а эта проверка только объясняет.
--
-- `is not distinct from` вместо `=`: у общего шаблона project равен NULL, а
-- обычное сравнение с NULL дало бы неопределённость, и второй общий шаблон
-- одного вида проскочил бы мимо проверки (ровно та ловушка, из-за которой
-- уникальность и сделана двумя частичными индексами).

create or replace function public.portal_save_quality_checklist_tree(
  p_checklist_id uuid,
  p_payload jsonb,
  p_expected_version integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.portal_current_user_id();
  v_actor_login text;
  v_checklist_id uuid;
  v_project text := nullif(p_payload ->> 'project', '');
  v_kind text := p_payload ->> 'kind';
  v_title text := btrim(coalesce(p_payload ->> 'title', ''));
  v_existing public.quality_checklists%rowtype;
  v_group jsonb;
  v_item jsonb;
  v_group_id uuid;
  v_item_id uuid;
  v_kept_groups uuid[] := '{}';
  v_kept_items uuid[] := '{}';
  v_group_index integer := 0;
  v_item_index integer;
  v_used boolean;
begin
  if not public.portal_can_edit_section('quality') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select login into v_actor_login from public.portal_users where id = v_actor;

  if v_title = '' then
    raise exception 'Название шаблона обязательно' using errcode = '23514';
  end if;

  if v_kind not in ('call', 'refusal') then
    raise exception 'Неизвестный вид проверки' using errcode = '23514';
  end if;

  -- Проектная изоляция. Общий шаблон (project is null) её не требует: он не
  -- принадлежит никакому проекту, и запрет на его правку означал бы, что
  -- править его нельзя вообще никому.
  if v_project is not null and not public.portal_has_project(v_project) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Один действующий шаблон на пару «вид + проект».
  if exists (
    select 1
    from public.quality_checklists c
    where c.kind = v_kind
      and c.archived_at is null
      and c.project is not distinct from v_project
      and (p_checklist_id is null or c.id <> p_checklist_id)
  ) then
    raise exception 'Для этого вида проверки и проекта уже есть действующий шаблон. Уберите прежний в архив или правьте его.'
      using errcode = '23505';
  end if;

  if p_checklist_id is null then
    insert into public.quality_checklists (title, kind, project, created_by, created_by_login, updated_by, updated_by_login)
    values (v_title, v_kind, v_project, v_actor, v_actor_login, v_actor, v_actor_login)
    returning id into v_checklist_id;
  else
    -- `for update` держит строку до конца транзакции: без него две
    -- одновременные правки могли бы обе прочитать одну версию и обе пройти
    -- проверку.
    select * into v_existing from public.quality_checklists where id = p_checklist_id for update;
    if not found then
      raise exception 'Шаблон не найден' using errcode = 'P0002';
    end if;

    -- Доступ проверяется и для проекта, который у шаблона уже записан:
    -- иначе шаблон чужого проекта можно было бы «перенести» к себе, прислав
    -- свой проект в payload.
    if v_existing.project is not null and not public.portal_has_project(v_existing.project) then
      raise exception 'forbidden' using errcode = '42501';
    end if;

    if p_expected_version is null or p_expected_version <> v_existing.version then
      raise exception 'version_conflict' using errcode = '40001';
    end if;

    v_checklist_id := p_checklist_id;

    update public.quality_checklists
    set title = v_title,
        kind = v_kind,
        project = v_project,
        updated_by = v_actor,
        updated_by_login = v_actor_login
    where id = v_checklist_id;
  end if;

  -- Блоки и пункты ---------------------------------------------------------
  for v_group in select * from jsonb_array_elements(coalesce(p_payload -> 'groups', '[]'::jsonb))
  loop
    v_group_index := v_group_index + 1;

    if btrim(coalesce(v_group ->> 'title', '')) = '' then
      raise exception 'Название блока обязательно' using errcode = '23514';
    end if;

    if v_group ->> 'id' is null then
      insert into public.quality_checklist_groups (checklist_id, title, counts_in_total, sort_order)
      values (
        v_checklist_id,
        btrim(v_group ->> 'title'),
        coalesce((v_group ->> 'counts_in_total')::boolean, true),
        v_group_index
      )
      returning id into v_group_id;
    else
      v_group_id := (v_group ->> 'id')::uuid;
      update public.quality_checklist_groups
      set title = btrim(v_group ->> 'title'),
          counts_in_total = coalesce((v_group ->> 'counts_in_total')::boolean, true),
          sort_order = v_group_index,
          -- Возврат блока из архива: он снова в payload, значит снова нужен.
          archived_at = null
      where id = v_group_id and checklist_id = v_checklist_id;

      if not found then
        raise exception 'Блок не принадлежит шаблону' using errcode = '23503';
      end if;
    end if;

    v_kept_groups := v_kept_groups || v_group_id;
    v_item_index := 0;

    for v_item in select * from jsonb_array_elements(coalesce(v_group -> 'items', '[]'::jsonb))
    loop
      v_item_index := v_item_index + 1;

      if btrim(coalesce(v_item ->> 'title', '')) = '' then
        raise exception 'Название пункта обязательно' using errcode = '23514';
      end if;

      if (v_item ->> 'scale') not in ('0-1-2', '0-2', 'yes_no') then
        raise exception 'Неизвестная шкала пункта' using errcode = '23514';
      end if;

      if coalesce((v_item ->> 'weight')::integer, 1) < 1 then
        raise exception 'Вес пункта не может быть меньше единицы' using errcode = '23514';
      end if;

      if v_item ->> 'id' is null then
        insert into public.quality_checklist_items (group_id, title, scale, weight, allow_na, is_critical, sort_order)
        values (
          v_group_id,
          btrim(v_item ->> 'title'),
          v_item ->> 'scale',
          coalesce((v_item ->> 'weight')::integer, 1),
          coalesce((v_item ->> 'allow_na')::boolean, true),
          coalesce((v_item ->> 'is_critical')::boolean, false),
          v_item_index
        )
        returning id into v_item_id;
      else
        v_item_id := (v_item ->> 'id')::uuid;
        update public.quality_checklist_items
        set title = btrim(v_item ->> 'title'),
            scale = v_item ->> 'scale',
            weight = coalesce((v_item ->> 'weight')::integer, 1),
            allow_na = coalesce((v_item ->> 'allow_na')::boolean, true),
            is_critical = coalesce((v_item ->> 'is_critical')::boolean, false),
            sort_order = v_item_index,
            archived_at = null
        where id = v_item_id and group_id = v_group_id;

        if not found then
          raise exception 'Пункт не принадлежит блоку' using errcode = '23503';
        end if;
      end if;

      v_kept_items := v_kept_items || v_item_id;
    end loop;
  end loop;

  -- Пропавшее из payload: удалить, если никто не ссылался, иначе
  -- заархивировать. Порядок важен — сначала пункты, потом блоки.
  for v_item_id in
    select i.id
    from public.quality_checklist_items i
    join public.quality_checklist_groups g on g.id = i.group_id
    where g.checklist_id = v_checklist_id
      and not (i.id = any(v_kept_items))
  loop
    select exists (select 1 from public.quality_review_scores where item_id = v_item_id) into v_used;
    if v_used then
      update public.quality_checklist_items set archived_at = now() where id = v_item_id and archived_at is null;
    else
      delete from public.quality_checklist_items where id = v_item_id;
    end if;
  end loop;

  for v_group_id in
    select id from public.quality_checklist_groups
    where checklist_id = v_checklist_id and not (id = any(v_kept_groups))
  loop
    -- Блок с уцелевшими (архивными) пунктами удалить нельзя — на них
    -- ссылаются оценки, и внешний ключ пункта смотрит на блок.
    select exists (select 1 from public.quality_checklist_items where group_id = v_group_id) into v_used;
    if v_used then
      update public.quality_checklist_groups set archived_at = now() where id = v_group_id and archived_at is null;
    else
      delete from public.quality_checklist_groups where id = v_group_id;
    end if;
  end loop;

  return jsonb_build_object(
    'id', v_checklist_id,
    'version', (select version from public.quality_checklists where id = v_checklist_id)
  );
end;
$$;

comment on function public.portal_save_quality_checklist_tree(uuid, jsonb, integer) is
  'Сохраняет шаблон проверки качества целиком одной транзакцией: сам шаблон, блоки и пункты, включая вставки, обновления и удаления. Пропавшая из payload строка удаляется, только если на неё не ссылается ни одна проверка, иначе архивируется. Проверяет право на раздел, доступ к проекту шаблона (и к записанному, и к присланному), единственность действующего шаблона на пару «вид + проект» и версию. p_checklist_id = null создаёт шаблон.';

revoke execute on function public.portal_save_quality_checklist_tree(uuid, jsonb, integer) from public;
revoke execute on function public.portal_save_quality_checklist_tree(uuid, jsonb, integer) from anon;
grant execute on function public.portal_save_quality_checklist_tree(uuid, jsonb, integer) to authenticated;
