-- Два агрегата под графики сводки: динамика по месяцам и распределение
-- проверок по диапазонам итога.
--
-- ПОЧЕМУ ОТДЕЛЬНЫМИ ФУНКЦИЯМИ, А НЕ СЧЁТОМ НА КЛИЕНТЕ. Существующие
-- `portal_quality_report` и `portal_quality_report_by_group` отдают средние
-- по сотрудникам за период целиком. Из них ни помесячный разрез, ни
-- распределение самих проверок не собрать: и то и другое требует заглянуть
-- в отдельные строки `quality_reviews`, а грузить их в браузер ради графика
-- — то самое «загрузить всё и посчитать на клиенте», от которого раздел
-- уходил с первого дня (в исходной таблице за один июнь 2765 проверок).
--
-- ОБЕ ФУНКЦИИ ПОВТОРЯЮТ ПРАВИЛА ОСТАЛЬНЫХ АГРЕГАТОВ. Считаются только
-- завершённые проверки; архивные исключены; право на раздел и проектная
-- изоляция проверяются внутри запроса, потому что SECURITY DEFINER обходит
-- политики таблицы.

-- 1. Динамика по месяцам ---------------------------------------------------
--
-- Вид проверки не сворачивается: команда просила видеть прослушки КЦ и
-- самоотказы раздельно, а сложенные вместе они дают линию, которая не
-- значит ничего — у них разные шкалы и разный смысл.

create or replace function public.portal_quality_report_by_month(
  p_from date,
  p_to date,
  p_project text default null,
  p_kind text default null
)
returns table (
  month date,
  kind text,
  reviews_count bigint,
  scored_count bigint,
  avg_total numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    date_trunc('month', r.review_date)::date as month,
    r.kind,
    count(*) as reviews_count,
    count(*) filter (where r.total_score is not null) as scored_count,
    round(avg(r.total_score), 2) as avg_total
  from public.quality_reviews r
  where public.portal_can_view_section('quality')
    and public.portal_has_project(r.project)
    and r.status = 'completed'
    and r.archived_at is null
    and r.review_date >= p_from
    and r.review_date <= p_to
    and (p_project is null or r.project = p_project)
    and (p_kind is null or r.kind = p_kind)
  group by 1, 2
  order by 1, 2;
$$;

comment on function public.portal_quality_report_by_month(date, date, text, text) is
  'Помесячная динамика проверок качества: сколько заведено, у скольких есть итог и каков средний. Вид проверки не сворачивается — у прослушек КЦ и самоотказов разный смысл, и общая линия по ним не значит ничего. Черновики и архивные не учитываются. Право и проектная изоляция проверяются внутри запроса.';

revoke execute on function public.portal_quality_report_by_month(date, date, text, text) from public;
revoke execute on function public.portal_quality_report_by_month(date, date, text, text) from anon;
grant execute on function public.portal_quality_report_by_month(date, date, text, text) to authenticated;

-- 2. Распределение проверок по диапазонам ----------------------------------
--
-- Отвечает на то, что среднее прячет: «82% по команде» — это все работают
-- ровно или половина по 100, а половина по 60. Разница между этими случаями
-- определяет, учить всех или разбираться с конкретными людьми.
--
-- Границы те же, что у цвета бейджа в интерфейсе (90 и 70) плюс 50: три
-- порога вместо двух, потому что «ниже 70» без деления сваливает в одну кучу
-- слабую работу и провал.
--
-- Диапазоны возвращаются всегда все четыре, даже пустые: отсутствие столбца
-- читалось бы как «таких нет», а ноль — как «таких нет, и мы это
-- посчитали». Второе честнее.

create or replace function public.portal_quality_score_distribution(
  p_from date,
  p_to date,
  p_project text default null,
  p_kind text default null
)
returns table (
  bucket text,
  bucket_order integer,
  reviews_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with buckets as (
    select * from (values
      ('90–100%', 1, 90::numeric, 100.01::numeric),
      ('70–90%',  2, 70::numeric, 90::numeric),
      ('50–70%',  3, 50::numeric, 70::numeric),
      ('ниже 50%', 4, -0.01::numeric, 50::numeric)
    ) as t(label, ord, lo, hi)
  ), scored as (
    select r.total_score
    from public.quality_reviews r
    where public.portal_can_view_section('quality')
      and public.portal_has_project(r.project)
      and r.status = 'completed'
      and r.archived_at is null
      and r.total_score is not null
      and r.review_date >= p_from
      and r.review_date <= p_to
      and (p_project is null or r.project = p_project)
      and (p_kind is null or r.kind = p_kind)
  )
  select
    b.label as bucket,
    b.ord as bucket_order,
    count(s.total_score) as reviews_count
  from buckets b
  left join scored s on s.total_score >= b.lo and s.total_score < b.hi
  group by b.label, b.ord
  order by b.ord;
$$;

comment on function public.portal_quality_score_distribution(date, date, text, text) is
  'Сколько завершённых проверок попало в каждый диапазон итога. Показывает то, что среднее прячет: ровно ли работает команда или её тянут вверх отдельные люди. Диапазоны возвращаются всегда все четыре, включая пустые — ноль честнее отсутствующего столбца. Черновики, архивные и проверки без итога не учитываются.';

revoke execute on function public.portal_quality_score_distribution(date, date, text, text) from public;
revoke execute on function public.portal_quality_score_distribution(date, date, text, text) from anon;
grant execute on function public.portal_quality_score_distribution(date, date, text, text) to authenticated;
