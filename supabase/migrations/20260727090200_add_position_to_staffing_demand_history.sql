-- Этап 2 «Должности»: history-таблица получает то же третье измерение, что
-- и её источники (staffing_demand, staffing_demand_rows), обе миграции
-- которых применяются перед этой. position делается NOT NULL, без
-- исключений — та же размерность, что и в основных таблицах, чтобы нигде
-- в коде не понадобилась ветка "position может быть null".

alter table public.staffing_demand_history add column position text;

-- Backfill: единственная существующая запись истории (проверено перед
-- написанием миграции) тоже получает 'Курьер' — тот же дефолт, что и в
-- staffing_demand/staffing_demand_rows, ради единообразия схемы. Небольшое
-- сознательное искажение аудита: эта конкретная запись реально была не о
-- должности «Курьер», а сделана ещё до появления должностей вовсе.
update public.staffing_demand_history set position = 'Курьер' where position is null;

alter table public.staffing_demand_history alter column position set not null;

comment on column public.staffing_demand_history.position is
  'Должность, к которой относится изменение — заполнено всегда (source-таблицы position NOT NULL), демаркация insert/update/delete между staffing_demand и staffing_demand_rows по-прежнему через demand_date (см. комментарий на этой колонке).';

-- Пересобираем обе триггерные функции, чтобы протащить position в записи
-- истории. create or replace безопасен: тело меняется, имя/владелец и уже
-- привязанные триггеры — нет, пересоздавать триггеры не нужно.

create or replace function public.log_staffing_demand_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.staffing_demand_history
      (staffing_demand_id, project, city, position, demand_date, new_quantity, action, changed_by)
    values (new.id, new.project, new.city, new.position, new.demand_date, new.planned_count, 'insert', auth.uid());
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.staffing_demand_history
      (staffing_demand_id, project, city, position, demand_date, old_quantity, new_quantity, action, changed_by)
    values (new.id, new.project, new.city, new.position, new.demand_date, old.planned_count, new.planned_count, 'update', auth.uid());
    return new;
  else
    insert into public.staffing_demand_history
      (staffing_demand_id, project, city, position, demand_date, old_quantity, action, changed_by)
    values (old.id, old.project, old.city, old.position, old.demand_date, old.planned_count, 'delete', auth.uid());
    return old;
  end if;
end;
$$;

create or replace function public.log_staffing_demand_rows_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.staffing_demand_history
      (project, city, position, new_status, new_comment, action, changed_by)
    values (new.project, new.city, new.position, new.status, new.comment, 'insert', auth.uid());
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.staffing_demand_history
      (project, city, position, old_status, new_status, old_comment, new_comment, action, changed_by)
    values (new.project, new.city, new.position, old.status, new.status, old.comment, new.comment, 'update', auth.uid());
    return new;
  else
    insert into public.staffing_demand_history
      (project, city, position, old_status, old_comment, action, changed_by)
    values (old.project, old.city, old.position, old.status, old.comment, 'delete', auth.uid());
    return old;
  end if;
end;
$$;

-- Составной индекс под реальный запрос DemandHistoryDrawer: история одной
-- конкретной тройки project+city+position, свежие записи сверху. Здесь (в
-- отличие от staffing_demand/staffing_demand_rows) отдельный индекс нужен —
-- в этой таблице нет уникального констрейнта, который дал бы такой индекс
-- "бесплатно".
create index idx_staffing_demand_history_lookup
  on public.staffing_demand_history (project, city, position, changed_at desc);
