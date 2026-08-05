-- Field-level "who/when/what" audit trail for vacancies, independent of the
-- client: every insert/update/delete on vacancy_projects/vacancy_sections/
-- vacancy_fields/vacancy_attachments is logged here by a SECURITY DEFINER
-- trigger, so the client cannot forge or skip an entry. Not a row-by-row
-- diff viewer — `old_data`/`new_data` are whole-row `to_jsonb()` snapshots,
-- which is simpler and more robust than hand-comparing which columns
-- changed on 4 differently-shaped tables, at the cost of a coarser history
-- entry than a column-level diff.
--
-- One shared table for all four sources, discriminated by `entity_type` +
-- `entity_id` (no FK on entity_id — a deleted section/field must still show
-- up in history after it's gone). `vacancy_project_id` IS a real FK: unlike
-- staffing_demand_history (which survives its source row's physical
-- deletion), vacancy_projects itself is never hard-deleted, only archived —
-- so history rows never orphan in practice, and a real FK lets `on delete
-- cascade` clean up if a project is ever removed by hand in the DB.

create table public.vacancy_history (
  id uuid primary key default gen_random_uuid(),
  vacancy_project_id uuid not null references public.vacancy_projects (id) on delete cascade,
  entity_type text not null check (entity_type in ('project', 'section', 'field', 'attachment')),
  entity_id uuid not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  old_data jsonb,
  new_data jsonb,
  changed_by uuid references public.portal_users (id) on delete set null,
  changed_by_login text,
  changed_at timestamptz not null default now()
);

comment on table public.vacancy_history is
  'Аудит изменений вакансии: снимки старой/новой строки на insert/update/delete проекта/раздела/поля/вложения. Пишется только SECURITY DEFINER-триггерами ниже, клиент не может вставлять/менять/удалять записи напрямую.';

create index idx_vacancy_history_project on public.vacancy_history (vacancy_project_id, changed_at desc);

alter table public.vacancy_history enable row level security;

create policy "portal_select_vacancy_history"
  on public.vacancy_history for select to authenticated
  using (public.portal_can('vacancies'));
-- Намеренно нет insert/update/delete политик для authenticated — таблицу
-- пишут только SECURITY DEFINER триггеры ниже.

-- Триггеры-писатели ------------------------------------------------------
-- SECURITY DEFINER нужен, чтобы прочитать portal_users.login (та таблица
-- полностью закрыта RLS для authenticated) — то же обоснование, что у
-- set_addresses_audit_fields()/set_rates_audit_fields().

create function public.log_vacancy_project_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.portal_current_user_id();
  v_login text;
begin
  if v_uid is not null then
    select login into v_login from public.portal_users where id = v_uid;
  end if;

  if tg_op = 'INSERT' then
    insert into public.vacancy_history (vacancy_project_id, entity_type, entity_id, action, new_data, changed_by, changed_by_login)
    values (new.id, 'project', new.id, 'insert', to_jsonb(new), v_uid, v_login);
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.vacancy_history (vacancy_project_id, entity_type, entity_id, action, old_data, new_data, changed_by, changed_by_login)
    values (new.id, 'project', new.id, 'update', to_jsonb(old), to_jsonb(new), v_uid, v_login);
    return new;
  else
    insert into public.vacancy_history (vacancy_project_id, entity_type, entity_id, action, old_data, changed_by, changed_by_login)
    values (old.id, 'project', old.id, 'delete', to_jsonb(old), v_uid, v_login);
    return old;
  end if;
end;
$$;

create trigger trg_vacancy_projects_history
  after insert or update or delete on public.vacancy_projects
  for each row execute function public.log_vacancy_project_change();

create function public.log_vacancy_section_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.portal_current_user_id();
  v_login text;
begin
  if v_uid is not null then
    select login into v_login from public.portal_users where id = v_uid;
  end if;

  if tg_op = 'INSERT' then
    insert into public.vacancy_history (vacancy_project_id, entity_type, entity_id, action, new_data, changed_by, changed_by_login)
    values (new.vacancy_project_id, 'section', new.id, 'insert', to_jsonb(new), v_uid, v_login);
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.vacancy_history (vacancy_project_id, entity_type, entity_id, action, old_data, new_data, changed_by, changed_by_login)
    values (new.vacancy_project_id, 'section', new.id, 'update', to_jsonb(old), to_jsonb(new), v_uid, v_login);
    return new;
  else
    insert into public.vacancy_history (vacancy_project_id, entity_type, entity_id, action, old_data, changed_by, changed_by_login)
    values (old.vacancy_project_id, 'section', old.id, 'delete', to_jsonb(old), v_uid, v_login);
    return old;
  end if;
end;
$$;

create trigger trg_vacancy_sections_history
  after insert or update or delete on public.vacancy_sections
  for each row execute function public.log_vacancy_section_change();

-- Fields don't carry vacancy_project_id directly — resolved via their
-- section on insert; on delete the section may already be gone (cascade
-- from a deleted project), so old.section_id's owning project is looked up
-- defensively and the row is skipped (not failed) if it can't be resolved.
create function public.log_vacancy_field_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.portal_current_user_id();
  v_login text;
  v_project_id uuid;
begin
  if v_uid is not null then
    select login into v_login from public.portal_users where id = v_uid;
  end if;

  select vacancy_project_id into v_project_id
  from public.vacancy_sections
  where id = coalesce(new.section_id, old.section_id);

  if v_project_id is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    insert into public.vacancy_history (vacancy_project_id, entity_type, entity_id, action, new_data, changed_by, changed_by_login)
    values (v_project_id, 'field', new.id, 'insert', to_jsonb(new), v_uid, v_login);
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.vacancy_history (vacancy_project_id, entity_type, entity_id, action, old_data, new_data, changed_by, changed_by_login)
    values (v_project_id, 'field', new.id, 'update', to_jsonb(old), to_jsonb(new), v_uid, v_login);
    return new;
  else
    insert into public.vacancy_history (vacancy_project_id, entity_type, entity_id, action, old_data, changed_by, changed_by_login)
    values (v_project_id, 'field', old.id, 'delete', to_jsonb(old), v_uid, v_login);
    return old;
  end if;
end;
$$;

create trigger trg_vacancy_fields_history
  after insert or update or delete on public.vacancy_fields
  for each row execute function public.log_vacancy_field_change();

create function public.log_vacancy_attachment_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.portal_current_user_id();
  v_login text;
begin
  if v_uid is not null then
    select login into v_login from public.portal_users where id = v_uid;
  end if;

  if tg_op = 'INSERT' then
    insert into public.vacancy_history (vacancy_project_id, entity_type, entity_id, action, new_data, changed_by, changed_by_login)
    values (new.vacancy_project_id, 'attachment', new.id, 'insert', to_jsonb(new), v_uid, v_login);
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.vacancy_history (vacancy_project_id, entity_type, entity_id, action, old_data, new_data, changed_by, changed_by_login)
    values (new.vacancy_project_id, 'attachment', new.id, 'update', to_jsonb(old), to_jsonb(new), v_uid, v_login);
    return new;
  else
    insert into public.vacancy_history (vacancy_project_id, entity_type, entity_id, action, old_data, changed_by, changed_by_login)
    values (old.vacancy_project_id, 'attachment', old.id, 'delete', to_jsonb(old), v_uid, v_login);
    return old;
  end if;
end;
$$;

create trigger trg_vacancy_attachments_history
  after insert or update or delete on public.vacancy_attachments
  for each row execute function public.log_vacancy_attachment_change();
