-- TASK-013, фаза C1 аудита (BUG-03): средний итог по разделу считался
-- неверно, как только появлялась проверка без итога.
--
-- Что было. Функция отдавала `reviews_count` (все завершённые проверки) и
-- `avg_total` (среднее **только по строкам с непустым** total_score —
-- avg() игнорирует NULL). Интерфейс взвешивал среднее сотрудника на
-- `reviews_count`, то есть на число, включающее строки, которые в это
-- среднее не входили. Пока итог есть у всех — совпадает; стоит появиться
-- одной проверке без итога, и общий средний по разделу поедет.
--
-- Проверка без итога — не выдумка и не ошибка данных: итог равен NULL,
-- когда считать было не из чего (все пункты «не применимо» или
-- единственный блок выключен переключателем «возражения не было»). Это
-- законное состояние, и правило «NULL, а не 0» специально закреплено в
-- ADR-006 — ноль означал бы «всё провалено».
--
-- Что становится. Добавляется `scored_count` — сколько проверок реально
-- дали число. Взвешивание на него делает общий средний точным:
--   Σ(avg_e × scored_e) / Σ scored_e = среднее по всем оценённым проверкам.
--
-- Заодно это честная цифра для интерфейса: «средний итог по 12 из 15
-- проверок» видно сразу, а не выясняется при разборе расхождения.
--
-- drop + create, а не create or replace: состав колонок у `returns table`
-- через replace не меняется (тот же случай, что с
-- portal_admin_list_users() в фазе D — см. 20260813100100). Поэтому же
-- ниже заново выдаётся EXECUTE: при drop гранты теряются.

drop function if exists public.portal_quality_report(date, date, text, text);

create function public.portal_quality_report(
  p_from date,
  p_to date,
  p_project text default null,
  p_kind text default null
)
returns table (
  employee_name text,
  project text,
  reviews_count bigint,
  scored_count bigint,
  avg_total numeric,
  cases_count bigint,
  critical_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.employee_name,
    r.project,
    count(*) as reviews_count,
    -- Столько строк попало в avg_total. Разница с reviews_count — это
    -- проверки, где считать было не из чего.
    count(*) filter (where r.total_score is not null) as scored_count,
    round(avg(r.total_score), 2) as avg_total,
    count(*) filter (where r.is_case) as cases_count,
    count(*) filter (where r.has_critical) as critical_count
  from public.quality_reviews r
  where public.portal_can_view_section('quality')
    and public.portal_has_project(r.project)
    and r.status = 'completed'
    and r.review_date >= p_from
    and r.review_date <= p_to
    and (p_project is null or r.project = p_project)
    and (p_kind is null or r.kind = p_kind)
  group by r.employee_name, r.project
  order by r.employee_name, r.project;
$$;

comment on function public.portal_quality_report(date, date, text, text) is
  'Сводка проверок за период: количество, сколько из них дали числовой итог, средний итог, кейсы и критические ошибки по сотруднику и проекту. Черновики не учитываются. Право и проектная изоляция проверяются внутри запроса — функция SECURITY DEFINER и политики RLS обходит. scored_count нужен, чтобы взвешивать средние корректно: avg_total считается без строк с пустым итогом.';

revoke execute on function public.portal_quality_report(date, date, text, text) from public;
grant execute on function public.portal_quality_report(date, date, text, text) to authenticated;
