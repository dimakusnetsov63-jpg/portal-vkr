-- Этап 2 «Должности»: третье измерение матрицы «Потребность» — должность,
-- рядом с уже существующими проектом и городом. Значения курируются в
-- том же справочнике, что и candidates.position (candidate_list_options,
-- list_type = 'position'), тем же способом, каким уже курируется city —
-- без FK, просто текст с подсказками в UI.

alter table public.staffing_demand add column position text;

-- Backfill: на момент миграции в таблице всего 4 строки (проверено перед
-- написанием миграции), у всех position ещё не задан. 'Курьер' — самая
-- массовая должность в справочнике, разумное дефолтное значение;
-- координатор может поправить вручную под конкретный проект/город.
update public.staffing_demand set position = 'Курьер' where position is null;

alter table public.staffing_demand alter column position set not null;

comment on column public.staffing_demand.position is
  'Свободный текст, без FK на candidate_list_options (как city) — подсказки курируются отдельно (list_type = ''position''), не ограничивают значение.';

-- Уникальность и идентичность строки матрицы расширяются с (project, city,
-- demand_date) до (project, city, position, demand_date) — ячейка теперь
-- определяется тройкой project+city+position на конкретную дату.
alter table public.staffing_demand
  drop constraint staffing_demand_project_city_demand_date_key,
  add constraint staffing_demand_project_city_position_demand_date_key
    unique (project, city, position, demand_date);

-- Отдельный индекс по одному только position не добавляется: новый
-- уникальный констрейнт (project, city, position, demand_date) сам
-- является btree-индексом и уже покрывает срезы (project), (project,
-- city) и (project, city, position) — ровно то, чем реально фильтрует UI.
