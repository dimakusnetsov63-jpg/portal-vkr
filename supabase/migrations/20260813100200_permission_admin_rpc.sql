-- Управление матрицей прав и проектами пользователя (фаза D, ADR-005).
--
-- Три функции для будущего раздела «Настройки → Доступы» (фаза E). Все —
-- SECURITY DEFINER с проверкой portal_require_admin() внутри тела, как и
-- остальные portal_admin_*: portal_section_permissions закрыта RLS без
-- политик, поэтому иного пути к ней нет.
--
-- Гейт — именно portal_require_admin() (роль head), а не
-- portal_can_edit_section('users'). Решение сознательное: §24 ТЗ требует
-- «доступно только существующим администраторам согласно текущей модели», а
-- текущая модель — head. Если бы гейтом была ячейка матрицы, руководитель
-- мог бы выдать право users координатору, а тот — выдать своей роли всё
-- остальное и переписать строку head. Перевести гейт на новую модель позже
-- легко; вернуть обратно после того, как права разойдутся по ролям, —
-- заметно больнее.
--
-- Требует значений enum из 20260813100000 (отдельная миграция — новое
-- значение enum нельзя использовать в транзакции, которая его создала).

-- Чтение матрицы ----------------------------------------------------------
-- Возвращает все строки «для всех проектов» — 44 при baseline. Сортировка
-- по porder разделов и по роли, чтобы интерфейс не пересортировывал.
create function public.portal_admin_list_section_permissions()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  perform public.portal_require_admin();

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_result
  from (
    select p.role, p.section, p.visible, p.can_view, p.can_edit, p.updated_at
    from public.portal_section_permissions p
    where p.project is null
    order by p.role, array_position(public.portal_section_order(), p.section)
  ) t;

  return v_result;
end;
$$;

comment on function public.portal_admin_list_section_permissions() is
  'Матрица прав целиком для раздела «Настройки → Доступы». Только для роли head (portal_require_admin). Возвращает строки с project is null — правила «для всех проектов роли».';

-- Изменение одной ячейки --------------------------------------------------
create function public.portal_admin_set_section_permission(
  p_role public.portal_user_role,
  p_section text,
  p_visible boolean,
  p_can_view boolean,
  p_can_edit boolean
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_admin public.portal_users := public.portal_require_admin();
  v_before public.portal_section_permissions;
  v_after public.portal_section_permissions;
begin
  if p_section is null or not (p_section = any (public.portal_section_order())) then
    raise exception 'Неизвестный раздел: %', coalesce(p_section, 'null') using errcode = '22023';
  end if;

  -- Инвариант ТЗ проверяется и здесь, и CHECK-ограничением таблицы. Дубль
  -- намеренный: ограничение даёт невнятное сообщение о нарушении check, а
  -- интерфейсу нужно объяснить пользователю, что именно не так.
  if p_can_edit and not p_can_view then
    raise exception 'Редактирование невозможно без просмотра' using errcode = '23514';
  end if;
  if p_can_view and not p_visible then
    raise exception 'Просмотр невозможен, если раздел скрыт' using errcode = '23514';
  end if;

  -- Защита от самоблокировки. Без неё один неверный переключатель в
  -- интерфейсе закрывает портал навсегда: снять права у head больше некому,
  -- а вернуть их можно только напрямую из SQL Editor. «Настройки» нужны,
  -- чтобы попасть в раздел с этим переключателем, «Учётные записи» — чтобы
  -- управлять людьми; обе ячейки у head не отключаются.
  if p_role = 'head' and p_section in ('settings', 'users') and not (p_visible and p_can_view and p_can_edit) then
    raise exception 'Нельзя ограничить руководителю раздел «%» — иначе управление доступами станет недостижимым', p_section
      using errcode = '23514';
  end if;

  select * into v_before
  from public.portal_section_permissions
  where role = p_role and section = p_section and project is null;

  if not found then
    raise exception 'Правило для роли % и раздела % не найдено', p_role, p_section using errcode = 'P0002';
  end if;

  update public.portal_section_permissions
  set visible = p_visible,
      can_view = p_can_view,
      can_edit = p_can_edit
  where id = v_before.id
  returning * into v_after;

  -- Пишем всегда, даже если значения не изменились: журнал отвечает на
  -- вопрос «кто и когда трогал права», а не только «что поменялось».
  insert into public.portal_audit_log (action, actor_id, actor_login, target_id, target_login, details)
  values (
    'section_permission_changed', v_admin.id, v_admin.login, null, null,
    jsonb_build_object(
      'role', p_role,
      'section', p_section,
      'from', jsonb_build_object('visible', v_before.visible, 'can_view', v_before.can_view, 'can_edit', v_before.can_edit),
      'to', jsonb_build_object('visible', v_after.visible, 'can_view', v_after.can_view, 'can_edit', v_after.can_edit)
    )
  );

  return jsonb_build_object(
    'role', v_after.role,
    'section', v_after.section,
    'visible', v_after.visible,
    'can_view', v_after.can_view,
    'can_edit', v_after.can_edit,
    'updated_at', v_after.updated_at
  );
end;
$$;

comment on function public.portal_admin_set_section_permission(public.portal_user_role, text, boolean, boolean, boolean) is
  'Меняет одну ячейку матрицы прав (роль × раздел) и пишет в portal_audit_log «было → стало». Только для роли head. Инвариант can_edit => can_view => visible проверяется до записи, с внятным сообщением; у head разделы settings и users отключить нельзя — иначе управление доступами станет недостижимым.';

-- Проекты пользователя ----------------------------------------------------
-- Отдельная функция, а не новый аргумент portal_admin_update_user: у той
-- пришлось бы менять сигнатуру, а значит пересоздавать её вместе с грантами
-- и править всех вызывающих. Здесь же ровно один орган управления —
-- чекбокс «Все проекты» и список проектов из карточки пользователя.
create function public.portal_admin_set_user_projects(
  p_user_id uuid,
  p_projects text[],
  p_all_projects boolean
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

  -- Тот же смысл, что у CHECK-ограничения таблицы, но с внятным текстом.
  -- Пустой список допустим только вместе с «все проекты», иначе учётка не
  -- увидит ни одной строки ни в одном проектном разделе.
  if not coalesce(p_all_projects, false) and coalesce(array_length(p_projects, 1), 0) = 0 then
    raise exception 'Нужно выбрать хотя бы один проект или включить «Все проекты»' using errcode = '22023';
  end if;

  update public.portal_users
  set projects = coalesce(p_projects, '{}'::text[]),
      all_projects = coalesce(p_all_projects, false)
  where id = p_user_id
  returning * into v_user;

  insert into public.portal_audit_log (action, actor_id, actor_login, target_id, target_login, details)
  values (
    'user_projects_changed', v_admin.id, v_admin.login, v_user.id, v_user.login,
    jsonb_build_object(
      'from', jsonb_build_object('projects', to_jsonb(v_before.projects), 'all_projects', v_before.all_projects),
      'to', jsonb_build_object('projects', to_jsonb(v_user.projects), 'all_projects', v_user.all_projects)
    )
  );

  return public.portal_user_json(v_user);
end;
$$;

comment on function public.portal_admin_set_user_projects(uuid, text[], boolean) is
  'Меняет доступ пользователя к проектам: список и признак «все проекты». Пишет в portal_audit_log «было → стало». Только для роли head. Роли head проектный фильтр не касается вовсе — у неё bypass в portal_has_project().';

-- Согласование portal_admin_update_user с «Все проекты» -------------------
-- Она требовала непустой p_projects всегда (20260728120000). После
-- появления all_projects это делало учётку с «Все проекты» нередактируемой:
-- сохранить карточку с пустым списком было нельзя, хотя такое состояние
-- теперь законно и разрешено CHECK-ограничением таблицы.
--
-- Меняется ровно одно условие. Сигнатура прежняя, поэтому гранты и
-- вызывающий код не трогаются; остальное тело воспроизведено без
-- изменений, включая защиту последнего активного руководителя.
create or replace function public.portal_admin_update_user(
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
  -- Пустой список допустим, только если у учётки включены «Все проекты»
  -- (меняется отдельной функцией portal_admin_set_user_projects).
  if not v_before.all_projects and coalesce(array_length(p_projects, 1), 0) = 0 then
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
      projects = coalesce(p_projects, '{}'::text[])
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

-- Гранты ------------------------------------------------------------------
-- Тот же порядок, что у остальных portal_admin_*: сначала отобрать у
-- public (иначе право выполнять достаётся всем по умолчанию), затем выдать
-- authenticated. Проверка прав живёт внутри тела, а не в грантах.
revoke execute on function public.portal_admin_list_section_permissions() from public;
revoke execute on function public.portal_admin_set_section_permission(public.portal_user_role, text, boolean, boolean, boolean) from public;
revoke execute on function public.portal_admin_set_user_projects(uuid, text[], boolean) from public;

grant execute on function public.portal_admin_list_section_permissions() to authenticated;
grant execute on function public.portal_admin_set_section_permission(public.portal_user_role, text, boolean, boolean, boolean) to authenticated;
grant execute on function public.portal_admin_set_user_projects(uuid, text[], boolean) to authenticated;
