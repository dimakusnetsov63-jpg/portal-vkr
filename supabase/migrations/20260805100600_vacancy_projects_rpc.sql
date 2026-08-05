-- Fixed after a real apply attempt hit 42P10 ("for SELECT DISTINCT, ORDER BY
-- expressions must appear in select list") in search_vacancy_projects — see
-- that function below for the fix. All three CREATE statements use `create
-- or replace` (not plain `create`) so re-running this file after a partial
-- failure is safe regardless of which functions committed before the error.
--
-- RPC functions for the "Описание вакансии" editor. Editing a vacancy means
-- changing a whole tree (project + N sections + M fields + attachments) at
-- once — inserts, updates and deletes mixed together, plus an optimistic
-- concurrency check. Doing that as a sequence of separate PostgREST calls
-- from the client (as public.rate_cards/public.rates do for their simpler
-- two-level relationship) would not be atomic and would leave the version
-- check racing the writes; a single SECURITY DEFINER function makes the
-- whole tree update one transaction, matching the pattern already used for
-- multi-step operations in 20260728120000_portal_auth.sql
-- (portal_admin_create_user, etc.), extended here to project/section/field/
-- attachment rows instead of portal_users.
--
-- All three functions re-check `public.portal_can('vacancies') and
-- public.portal_can('settings')` themselves — being SECURITY DEFINER, they
-- bypass the RLS policies from 20260805100500 entirely, so the permission
-- check has to happen inside the function body, not rely on the table
-- policies to stop an unauthorized caller.

-- Сохранение дерева с проверкой версии ----------------------------------
--
-- p_payload shape:
-- {
--   "title": text, "category_option_id": uuid | null,
--   "attachments": [{"id": uuid|null, "title", "url", "type", "sort_order"}],  -- section_id = null (общие)
--   "sections": [{
--     "id": uuid | null, "title", "icon": text|null, "is_system": boolean, "sort_order": int,
--     "fields": [{"id": uuid|null, "label", "value", "field_type", "sort_order"}],
--     "attachments": [{"id": uuid|null, "title", "url", "type", "sort_order"}]
--   }]
-- }
--
-- Sections/fields/attachments present in the DB but absent from the payload
-- (by id) are deleted — except an is_system section, which raises instead
-- (the client-side editor never offers a way to remove it, but a
-- hand-crafted payload could try, and the DB is the actual enforcement
-- point, not the UI).
create or replace function public.portal_save_vacancy_project_tree(
  p_project_id uuid,
  p_expected_version integer,
  p_payload jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_current_version integer;
  v_section jsonb;
  v_field jsonb;
  v_attachment jsonb;
  v_section_id uuid;
  v_field_id uuid;
  v_attachment_id uuid;
  v_seen_section_ids uuid[] := array[]::uuid[];
  v_seen_field_ids uuid[];
  v_seen_attachment_ids uuid[] := array[]::uuid[];
  v_orphan record;
begin
  if not (public.portal_can('vacancies') and public.portal_can('settings')) then
    raise exception 'Недостаточно прав для редактирования описания вакансии' using errcode = '42501';
  end if;

  select version into v_current_version from public.vacancy_projects where id = p_project_id for update;
  if not found then
    raise exception 'Вакансия не найдена' using errcode = 'P0002';
  end if;
  if v_current_version is distinct from p_expected_version then
    raise exception 'version_conflict' using errcode = 'P0001';
  end if;

  update public.vacancy_projects
  set title = coalesce(p_payload ->> 'title', title),
      category_option_id = nullif(p_payload ->> 'category_option_id', '')::uuid,
      version = version + 1
  where id = p_project_id;

  -- Разделы --------------------------------------------------------------
  for v_section in select * from jsonb_array_elements(coalesce(p_payload -> 'sections', '[]'::jsonb))
  loop
    if (v_section ->> 'id') is null then
      insert into public.vacancy_sections (vacancy_project_id, title, icon, is_system, sort_order)
      values (
        p_project_id,
        v_section ->> 'title',
        nullif(v_section ->> 'icon', ''),
        coalesce((v_section ->> 'is_system')::boolean, false),
        coalesce((v_section ->> 'sort_order')::integer, 0)
      )
      returning id into v_section_id;
    else
      v_section_id := (v_section ->> 'id')::uuid;
      update public.vacancy_sections
      set title = v_section ->> 'title',
          icon = nullif(v_section ->> 'icon', ''),
          sort_order = coalesce((v_section ->> 'sort_order')::integer, 0),
          archived_at = case when (v_section ->> 'archived_at') is null then null
                              else (v_section ->> 'archived_at')::timestamptz end
      where id = v_section_id and vacancy_project_id = p_project_id;
    end if;

    v_seen_section_ids := array_append(v_seen_section_ids, v_section_id);

    -- Поля этого раздела ---------------------------------------------
    v_seen_field_ids := array[]::uuid[];
    for v_field in select * from jsonb_array_elements(coalesce(v_section -> 'fields', '[]'::jsonb))
    loop
      if (v_field ->> 'id') is null then
        insert into public.vacancy_fields (section_id, label, value, field_type, sort_order)
        values (
          v_section_id,
          coalesce(v_field ->> 'label', ''),
          coalesce(v_field ->> 'value', ''),
          coalesce(v_field ->> 'field_type', 'text'),
          coalesce((v_field ->> 'sort_order')::integer, 0)
        )
        returning id into v_field_id;
      else
        v_field_id := (v_field ->> 'id')::uuid;
        update public.vacancy_fields
        set label = coalesce(v_field ->> 'label', ''),
            value = coalesce(v_field ->> 'value', ''),
            field_type = coalesce(v_field ->> 'field_type', 'text'),
            sort_order = coalesce((v_field ->> 'sort_order')::integer, 0)
        where id = v_field_id and section_id = v_section_id;
      end if;
      v_seen_field_ids := array_append(v_seen_field_ids, v_field_id);
    end loop;

    delete from public.vacancy_fields
    where section_id = v_section_id and not (id = any (v_seen_field_ids));

    -- Вложения этого раздела -------------------------------------------
    for v_attachment in select * from jsonb_array_elements(coalesce(v_section -> 'attachments', '[]'::jsonb))
    loop
      if (v_attachment ->> 'id') is null then
        insert into public.vacancy_attachments (vacancy_project_id, section_id, title, url, type, sort_order)
        values (
          p_project_id, v_section_id,
          v_attachment ->> 'title', v_attachment ->> 'url',
          coalesce(v_attachment ->> 'type', 'link'),
          coalesce((v_attachment ->> 'sort_order')::integer, 0)
        )
        returning id into v_attachment_id;
      else
        v_attachment_id := (v_attachment ->> 'id')::uuid;
        update public.vacancy_attachments
        set section_id = v_section_id,
            title = v_attachment ->> 'title',
            url = v_attachment ->> 'url',
            type = coalesce(v_attachment ->> 'type', 'link'),
            sort_order = coalesce((v_attachment ->> 'sort_order')::integer, 0)
        where id = v_attachment_id and vacancy_project_id = p_project_id;
      end if;
      v_seen_attachment_ids := array_append(v_seen_attachment_ids, v_attachment_id);
    end loop;
  end loop;

  -- Общие вложения (section_id = null) ------------------------------------
  for v_attachment in select * from jsonb_array_elements(coalesce(p_payload -> 'attachments', '[]'::jsonb))
  loop
    if (v_attachment ->> 'id') is null then
      insert into public.vacancy_attachments (vacancy_project_id, section_id, title, url, type, sort_order)
      values (
        p_project_id, null,
        v_attachment ->> 'title', v_attachment ->> 'url',
        coalesce(v_attachment ->> 'type', 'link'),
        coalesce((v_attachment ->> 'sort_order')::integer, 0)
      )
      returning id into v_attachment_id;
    else
      v_attachment_id := (v_attachment ->> 'id')::uuid;
      update public.vacancy_attachments
      set section_id = null,
          title = v_attachment ->> 'title',
          url = v_attachment ->> 'url',
          type = coalesce(v_attachment ->> 'type', 'link'),
          sort_order = coalesce((v_attachment ->> 'sort_order')::integer, 0)
      where id = v_attachment_id and vacancy_project_id = p_project_id;
    end if;
    v_seen_attachment_ids := array_append(v_seen_attachment_ids, v_attachment_id);
  end loop;

  -- Удаление отсутствующих в присланном дереве -----------------------------
  for v_orphan in
    select id, is_system from public.vacancy_sections
    where vacancy_project_id = p_project_id and not (id = any (v_seen_section_ids))
  loop
    if v_orphan.is_system then
      raise exception 'Нельзя удалить системный раздел «Общая информация»' using errcode = '23514';
    end if;
    delete from public.vacancy_sections where id = v_orphan.id;
  end loop;

  delete from public.vacancy_attachments
  where vacancy_project_id = p_project_id and not (id = any (v_seen_attachment_ids));

  return (select to_jsonb(vp) from public.vacancy_projects vp where vp.id = p_project_id);
end;
$$;

comment on function public.portal_save_vacancy_project_tree(uuid, integer, jsonb) is
  'Атомарное сохранение дерева вакансии (проект+разделы+поля+вложения) с проверкой версии (оптимистическая блокировка). Возвращает обновлённую строку vacancy_projects — клиент дальше перечитывает полное дерево обычным select.';

-- Дублирование -----------------------------------------------------------
create or replace function public.portal_duplicate_vacancy_project(p_project_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_source public.vacancy_projects;
  v_new_id uuid;
  v_section record;
  v_new_section_id uuid;
  v_field record;
  v_attachment record;
begin
  if not (public.portal_can('vacancies') and public.portal_can('settings')) then
    raise exception 'Недостаточно прав для редактирования описания вакансии' using errcode = '42501';
  end if;

  select * into v_source from public.vacancy_projects where id = p_project_id;
  if not found then
    raise exception 'Вакансия не найдена' using errcode = 'P0002';
  end if;

  insert into public.vacancy_projects (title, category_option_id)
  values (v_source.title || ' (копия)', v_source.category_option_id)
  returning id into v_new_id;

  for v_section in
    select * from public.vacancy_sections where vacancy_project_id = p_project_id order by sort_order
  loop
    insert into public.vacancy_sections (vacancy_project_id, title, icon, is_system, sort_order, archived_at)
    values (v_new_id, v_section.title, v_section.icon, v_section.is_system, v_section.sort_order, v_section.archived_at)
    returning id into v_new_section_id;

    for v_field in
      select * from public.vacancy_fields where section_id = v_section.id order by sort_order
    loop
      insert into public.vacancy_fields (section_id, label, value, field_type, sort_order)
      values (v_new_section_id, v_field.label, v_field.value, v_field.field_type, v_field.sort_order);
    end loop;

    for v_attachment in
      select * from public.vacancy_attachments where section_id = v_section.id order by sort_order
    loop
      insert into public.vacancy_attachments (vacancy_project_id, section_id, title, url, type, sort_order)
      values (v_new_id, v_new_section_id, v_attachment.title, v_attachment.url, v_attachment.type, v_attachment.sort_order);
    end loop;
  end loop;

  -- Общие вложения (section_id is null у исходной вакансии).
  for v_attachment in
    select * from public.vacancy_attachments where vacancy_project_id = p_project_id and section_id is null order by sort_order
  loop
    insert into public.vacancy_attachments (vacancy_project_id, section_id, title, url, type, sort_order)
    values (v_new_id, null, v_attachment.title, v_attachment.url, v_attachment.type, v_attachment.sort_order);
  end loop;

  return v_new_id;
end;
$$;

comment on function public.portal_duplicate_vacancy_project(uuid) is
  'Копирует вакансию целиком (разделы, поля, вложения) под новым id и title || '' (копия)'' одной транзакцией.';

-- Поиск по всем вакансиям --------------------------------------------------
-- Простой substring-поиск (ilike) по названию вакансии/раздела/подписи и
-- значения поля — без ранжирования по релевантности: для внутреннего
-- инструмента такого масштаба сортировка по названию вакансии достаточна,
-- усложнять её не нужно.
create or replace function public.search_vacancy_projects(p_query text)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  -- `order by` живёт на внешнем select, а не на select distinct, потому что
  -- Postgres запрещает order by по выражению, отсутствующему в списке
  -- select distinct (42P10) — vp.title нужен для сортировки, но не входит
  -- в возвращаемый setof uuid.
  select t.id
  from (
    select distinct vp.id, vp.title
    from public.vacancy_projects vp
    left join public.vacancy_sections vs on vs.vacancy_project_id = vp.id
    left join public.vacancy_fields vf on vf.section_id = vs.id
    where public.portal_can('vacancies')
      and btrim(coalesce(p_query, '')) <> ''
      and (
        vp.title ilike '%' || p_query || '%'
        or vs.title ilike '%' || p_query || '%'
        or vf.label ilike '%' || p_query || '%'
        or vf.value ilike '%' || p_query || '%'
      )
  ) t
  order by t.title;
$$;

comment on function public.search_vacancy_projects(text) is
  'Возвращает id вакансий, где встречается p_query — по названию вакансии/раздела/подписи или значению поля. Пусто, если нет доступа к разделу «Описание вакансии» или запрос пуст.';

revoke execute on function public.portal_save_vacancy_project_tree(uuid, integer, jsonb) from public;
revoke execute on function public.portal_duplicate_vacancy_project(uuid) from public;
revoke execute on function public.search_vacancy_projects(text) from public;

grant execute on function public.portal_save_vacancy_project_tree(uuid, integer, jsonb) to authenticated;
grant execute on function public.portal_duplicate_vacancy_project(uuid) to authenticated;
grant execute on function public.search_vacancy_projects(text) to authenticated;
