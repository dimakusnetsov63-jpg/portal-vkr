-- Фаза C3: «Описание вакансии» — политики и RPC на VIEW/EDIT (ADR-005).
--
-- 16 политик на 5 таблицах + три SECURITY DEFINER-функции.
--
-- Здесь связка `portal_can('vacancies') and portal_can('settings')`
-- **растворяется** в portal_can_edit_section('vacancies') — в отличие от
-- фазы C2, где такую же связку пришлось сохранить. Разница не в стиле, а в
-- данных: baseline-матрица (20260811100000) уже кодирует нужное различие
-- прямо в колонке can_edit раздела vacancies.
--
-- Доказательство эквивалентности по ролям:
--
--   роль          чтение сегодня → после     запись сегодня            → после
--   head          view(vac) T → T            view(vac) ∧ view(set) = T   edit(vac) = T
--   coordinator   view(vac) T → T            view(vac) ∧ view(set) = T   edit(vac) = T
--   manager       view(vac) T → T            view(vac) ∧ view(set) = F   edit(vac) = F
--   recruiter     view(vac) T → T            view(vac) ∧ view(set) = F   edit(vac) = F
--
-- То есть manager и recruiter сохраняют VIEW и не получают EDIT, а
-- head и coordinator сохраняют EDIT. Ровно то же равенство проверяется
-- тестами в src/testing/rls/sectionPermissions.rls-test.ts.
--
-- Проектной проверки здесь нет и не появляется: «проект вакансии» — это
-- отдельная сущность (запись с title/category_option_id), не то же самое,
-- что текстовая колонка project в кандидатах/адресах/ставках. Колонки
-- project у этих пяти таблиц нет вовсе.
--
-- Откат: прежние определения политик — в
-- 20260805100500_vacancy_projects_rls_policies.sql, прежние тела функций —
-- в 20260805100600_vacancy_projects_rpc.sql (оба файла написаны как
-- drop+create / create or replace, их достаточно выполнить повторно).

-- === vacancy_projects (без DELETE — soft-delete через archived_at) ===
drop policy "portal_select_vacancy_projects" on public.vacancy_projects;
drop policy "portal_insert_vacancy_projects" on public.vacancy_projects;
drop policy "portal_update_vacancy_projects" on public.vacancy_projects;

create policy "portal_select_vacancy_projects"
  on public.vacancy_projects for select to authenticated
  using (public.portal_can_view_section('vacancies'));
create policy "portal_insert_vacancy_projects"
  on public.vacancy_projects for insert to authenticated
  with check (public.portal_can_edit_section('vacancies'));
create policy "portal_update_vacancy_projects"
  on public.vacancy_projects for update to authenticated
  using (public.portal_can_edit_section('vacancies'))
  with check (public.portal_can_edit_section('vacancies'));

-- === vacancy_sections ===
drop policy "portal_select_vacancy_sections" on public.vacancy_sections;
drop policy "portal_insert_vacancy_sections" on public.vacancy_sections;
drop policy "portal_update_vacancy_sections" on public.vacancy_sections;
drop policy "portal_delete_vacancy_sections" on public.vacancy_sections;

create policy "portal_select_vacancy_sections"
  on public.vacancy_sections for select to authenticated
  using (public.portal_can_view_section('vacancies'));
create policy "portal_insert_vacancy_sections"
  on public.vacancy_sections for insert to authenticated
  with check (public.portal_can_edit_section('vacancies'));
create policy "portal_update_vacancy_sections"
  on public.vacancy_sections for update to authenticated
  using (public.portal_can_edit_section('vacancies'))
  with check (public.portal_can_edit_section('vacancies'));
create policy "portal_delete_vacancy_sections"
  on public.vacancy_sections for delete to authenticated
  using (public.portal_can_edit_section('vacancies'));

-- === vacancy_fields ===
drop policy "portal_select_vacancy_fields" on public.vacancy_fields;
drop policy "portal_insert_vacancy_fields" on public.vacancy_fields;
drop policy "portal_update_vacancy_fields" on public.vacancy_fields;
drop policy "portal_delete_vacancy_fields" on public.vacancy_fields;

create policy "portal_select_vacancy_fields"
  on public.vacancy_fields for select to authenticated
  using (public.portal_can_view_section('vacancies'));
create policy "portal_insert_vacancy_fields"
  on public.vacancy_fields for insert to authenticated
  with check (public.portal_can_edit_section('vacancies'));
create policy "portal_update_vacancy_fields"
  on public.vacancy_fields for update to authenticated
  using (public.portal_can_edit_section('vacancies'))
  with check (public.portal_can_edit_section('vacancies'));
create policy "portal_delete_vacancy_fields"
  on public.vacancy_fields for delete to authenticated
  using (public.portal_can_edit_section('vacancies'));

-- === vacancy_attachments ===
drop policy "portal_select_vacancy_attachments" on public.vacancy_attachments;
drop policy "portal_insert_vacancy_attachments" on public.vacancy_attachments;
drop policy "portal_update_vacancy_attachments" on public.vacancy_attachments;
drop policy "portal_delete_vacancy_attachments" on public.vacancy_attachments;

create policy "portal_select_vacancy_attachments"
  on public.vacancy_attachments for select to authenticated
  using (public.portal_can_view_section('vacancies'));
create policy "portal_insert_vacancy_attachments"
  on public.vacancy_attachments for insert to authenticated
  with check (public.portal_can_edit_section('vacancies'));
create policy "portal_update_vacancy_attachments"
  on public.vacancy_attachments for update to authenticated
  using (public.portal_can_edit_section('vacancies'))
  with check (public.portal_can_edit_section('vacancies'));
create policy "portal_delete_vacancy_attachments"
  on public.vacancy_attachments for delete to authenticated
  using (public.portal_can_edit_section('vacancies'));

-- === vacancy_history (только чтение — пишут SECURITY DEFINER-триггеры) ===
drop policy "portal_select_vacancy_history" on public.vacancy_history;

create policy "portal_select_vacancy_history"
  on public.vacancy_history for select to authenticated
  using (public.portal_can_view_section('vacancies'));

-- === SECURITY DEFINER RPC ===
--
-- Эти три функции обходят RLS полностью (в этом и смысл SECURITY DEFINER),
-- поэтому проверка прав внутри тела — не дубль политик, а самостоятельный
-- и **основной** гейт: редактор вакансий пишет дерево именно через
-- portal_save_vacancy_project_tree, а не прямыми запросами к таблицам.
--
-- Обновить их обязательно вместе с политиками. Иначе после фазы E
-- появились бы два расходящихся гейта записи: политика спрашивала бы
-- edit(vacancies), а функция — прежнюю связку через portal_can (то есть
-- VIEW). Достаточно администратору выставить роли settings view = true,
-- edit = false — и функция разрешила бы запись, которую политика
-- запрещает.
--
-- Тела функций воспроизведены без изменений; правится только строка
-- проверки прав.

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
  if not public.portal_can_edit_section('vacancies') then
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
  if not public.portal_can_edit_section('vacancies') then
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

-- Поиск — операция чтения, поэтому VIEW, а не EDIT: раздел «Описание
-- вакансии» читают все четыре роли, и поиск обязан работать у всех.
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
    where public.portal_can_view_section('vacancies')
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
