-- TASK-013, фаза G1 аудита (ANL-01): разрез сводки по блокам чек-листа.
--
-- Единственный блокер аналитики раздела. У команды в Excel есть «Сводная по
-- рекрутерам»: средний процент по каждому блоку — «Установление контакта»,
-- «Сбор первичной информации», «Презентация вакансии» и так далее — на
-- каждого сотрудника. Из портала эта таблица не строилась вовсе: проценты
-- блоков лежат в `quality_reviews.group_scores` (jsonb «id блока →
-- процент»), а функции, которая бы их развернула, не было. Пока её нет,
-- руководитель за своей ежемесячной цифрой всё равно идёт в таблицу.
--
-- Как устроено. `jsonb_each` разворачивает снимок процентов в строки,
-- `join` с `quality_checklist_groups` возвращает название и порядок блока.
-- Именно снимок, а не пересчёт из ответов: показывать нужно ту оценку,
-- которую человек получил, даже если шаблон с тех пор поправили (ADR-006).
--
-- `null` в снимке — законное значение: блок, где считать было не из чего
-- (все пункты «не применимо» либо блок выключен переключателем). Такие
-- значения не входят ни в среднее, ни в `scored_count`, но сам блок из
-- выдачи не исчезает — «по этому блоку оценок нет» отличается от «блока не
-- существует».
--
-- Черновики исключены, как и в `portal_quality_report`: незаконченная
-- проверка не должна двигать средние.
--
-- Разреза по месяцам здесь сознательно нет. Он удвоил бы форму выдачи, а
-- нужен не всегда: для «динамики по месяцам» вызывающий делает запрос на
-- каждый период. Появится отдельной функцией, когда под неё будет экран.

create function public.portal_quality_report_by_group(
  p_from date,
  p_to date,
  p_project text default null,
  p_kind text default null,
  p_employee text default null
)
returns table (
  employee_name text,
  group_id uuid,
  group_title text,
  group_sort_order integer,
  counts_in_total boolean,
  reviews_count bigint,
  scored_count bigint,
  avg_percent numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.employee_name,
    g.id as group_id,
    g.title as group_title,
    g.sort_order as group_sort_order,
    g.counts_in_total,
    count(*) as reviews_count,
    count(*) filter (where entry.value <> 'null'::jsonb) as scored_count,
    round(avg(nullif(entry.value, 'null'::jsonb)::numeric), 2) as avg_percent
  from public.quality_reviews r
  cross join lateral jsonb_each(r.group_scores) as entry(key, value)
  join public.quality_checklist_groups g on g.id = entry.key::uuid
  where public.portal_can_view_section('quality')
    and public.portal_has_project(r.project)
    and r.status = 'completed'
    and r.review_date >= p_from
    and r.review_date <= p_to
    and (p_project is null or r.project = p_project)
    and (p_kind is null or r.kind = p_kind)
    and (p_employee is null or r.employee_name = p_employee)
  group by r.employee_name, g.id, g.title, g.sort_order, g.counts_in_total
  order by r.employee_name, g.sort_order;
$$;

comment on function public.portal_quality_report_by_group(date, date, text, text, text) is
  'Средний процент по каждому блоку чек-листа на сотрудника за период — разрез, который в Excel назывался «Сводная по рекрутерам». Разворачивает снимок quality_reviews.group_scores, а не пересчитывает из ответов: показывается та оценка, которую человек получил. Блоки без числа остаются в выдаче с avg_percent = null и scored_count = 0. Черновики не учитываются. Право и проектная изоляция проверяются внутри запроса.';

revoke execute on function public.portal_quality_report_by_group(date, date, text, text, text) from public;
grant execute on function public.portal_quality_report_by_group(date, date, text, text, text) to authenticated;
