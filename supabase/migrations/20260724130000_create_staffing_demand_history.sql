-- Minimal audit trail for "Потребность" changes, independent of the client:
-- every insert/update/delete on public.staffing_demand (headcount by date)
-- and public.staffing_demand_rows (row-level status/comment) is logged here
-- by a SECURITY DEFINER trigger, so the client cannot forge or skip entries.
--
-- One shared table for both sources rather than two: `demand_date` doubles
-- as the discriminator — set = an entry about staffing_demand (quantity),
-- null = an entry about staffing_demand_rows (status/comment). No FK to
-- either source table (staffing_demand_id is a plain uuid): history must
-- survive the source row being deleted.
--
-- UI note (Этап 2C, first cut): only the "История изменений" action on a
-- demand cell (DemandCellMenu) reads from here, scoped to one
-- project+city+demand_date. The staffing_demand_rows half of this table is
-- written from day one but has no reader yet — a deliberate choice to keep
-- data capture and UI exposure decoupled; a status/comment history view can
-- be added later without any schema change.

create type public.staffing_demand_history_action as enum ('insert', 'update', 'delete');

create table public.staffing_demand_history (
  id uuid primary key default gen_random_uuid(),
  staffing_demand_id uuid,
  project text not null,
  city text not null,
  demand_date date,
  old_quantity integer,
  new_quantity integer,
  old_status text,
  new_status text,
  old_comment text,
  new_comment text,
  action public.staffing_demand_history_action not null,
  changed_by uuid,
  changed_at timestamptz not null default now()
);

comment on table public.staffing_demand_history is
  'Аудит изменений «Потребности»: количество (staffing_demand, demand_date заполнено) и статус/комментарий строки (staffing_demand_rows, demand_date = null). Пишется только SECURITY DEFINER триггерами, клиент не может вставлять/менять/удалять записи напрямую.';
comment on column public.staffing_demand_history.demand_date is
  'Заполнено = запись о staffing_demand (количество на дату). NULL = запись о staffing_demand_rows (статус/комментарий, не привязаны к дате) — используется как различитель источника вместо отдельного поля.';
comment on column public.staffing_demand_history.staffing_demand_id is
  'id исходной строки staffing_demand на момент изменения, без FK — история переживает физическое удаление ячейки. NULL для записей о staffing_demand_rows.';

create index idx_staffing_demand_history_cell
  on public.staffing_demand_history (project, city, demand_date, changed_at desc);
create index idx_staffing_demand_history_row
  on public.staffing_demand_history (project, city, changed_at desc)
  where demand_date is null;

-- Row Level Security --------------------------------------------------
alter table public.staffing_demand_history enable row level security;

create policy "authenticated_select_staffing_demand_history"
  on public.staffing_demand_history for select to authenticated using (true);
-- Намеренно нет insert/update/delete политик для authenticated — таблицу
-- пишут только SECURITY DEFINER триггеры ниже.

-- Триггер на staffing_demand (количество) ------------------------------
create function public.log_staffing_demand_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.staffing_demand_history
      (staffing_demand_id, project, city, demand_date, new_quantity, action, changed_by)
    values (new.id, new.project, new.city, new.demand_date, new.planned_count, 'insert', auth.uid());
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.staffing_demand_history
      (staffing_demand_id, project, city, demand_date, old_quantity, new_quantity, action, changed_by)
    values (new.id, new.project, new.city, new.demand_date, old.planned_count, new.planned_count, 'update', auth.uid());
    return new;
  else
    insert into public.staffing_demand_history
      (staffing_demand_id, project, city, demand_date, old_quantity, action, changed_by)
    values (old.id, old.project, old.city, old.demand_date, old.planned_count, 'delete', auth.uid());
    return old;
  end if;
end;
$$;

create trigger trg_staffing_demand_history
  after insert or update or delete on public.staffing_demand
  for each row execute function public.log_staffing_demand_change();

-- Триггер на staffing_demand_rows (статус/комментарий) -----------------
create function public.log_staffing_demand_rows_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.staffing_demand_history
      (project, city, new_status, new_comment, action, changed_by)
    values (new.project, new.city, new.status, new.comment, 'insert', auth.uid());
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.staffing_demand_history
      (project, city, old_status, new_status, old_comment, new_comment, action, changed_by)
    values (new.project, new.city, old.status, new.status, old.comment, new.comment, 'update', auth.uid());
    return new;
  else
    insert into public.staffing_demand_history
      (project, city, old_status, old_comment, action, changed_by)
    values (old.project, old.city, old.status, old.comment, 'delete', auth.uid());
    return old;
  end if;
end;
$$;

create trigger trg_staffing_demand_rows_history
  after insert or update or delete on public.staffing_demand_rows
  for each row execute function public.log_staffing_demand_rows_change();
