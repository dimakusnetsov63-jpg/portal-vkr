-- Этап 2 «Должности»: статус и комментарий строки «Потребности» переезжают
-- с пары (project, city) на тройку (project, city, position) — комментарий
-- и статус теперь относятся к конкретной должности внутри города, а не ко
-- всему городу целиком.

alter table public.staffing_demand_rows add column position text;

-- Backfill: на момент миграции всего 1 строка метаданных (проверено перед
-- написанием миграции), тот же дефолт, что и в staffing_demand.
update public.staffing_demand_rows set position = 'Курьер' where position is null;

alter table public.staffing_demand_rows alter column position set not null;

comment on column public.staffing_demand_rows.position is
  'Свободный текст, без FK на candidate_list_options (как project/city в этой таблице) — определяет, к какой должности внутри города относится статус/комментарий.';

alter table public.staffing_demand_rows
  drop constraint staffing_demand_rows_project_city_key,
  add constraint staffing_demand_rows_project_city_position_key
    unique (project, city, position);

-- Отдельный индекс не добавляется по той же причине, что и в
-- staffing_demand: новый уникальный констрейнт (project, city, position)
-- уже покрывает нужные срезы запросов.
