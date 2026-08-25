-- Статистика по возражениям кандидатов.
--
-- ЧЕМ ЭТОТ АГРЕГАТ ОТЛИЧАЕТСЯ ОТ ОСТАЛЬНЫХ. Все существующие отвечают на
-- вопрос «как работают наши люди»: средний процент, разрез по блокам,
-- динамика. Этот — про то, **что говорят кандидаты**. Возражение приходит не
-- от контролёра и не от рекрутёра, а из разговора, и его частота ничего не
-- говорит о качестве работы: она говорит об условиях вакансии, о городе, о
-- рынке.
--
-- Поэтому здесь две величины, а не одна. Частота отвечает на «что мы слышим
-- чаще всего», средний итог — на «с чем мы справляемся хуже всего».
-- Возражение, которое звучит сто раз и отрабатывается на сорок процентов, —
-- это не наблюдение, а задача; по одной частоте его не отличить от
-- возражения, которое звучит так же часто, но закрывается успешно.
--
-- Пустое возражение не считается вовсе: «не заполнили» и «возражения не
-- было» — разные вещи, и складывать их в строку «прочее» значило бы выдумать
-- категорию, которой в данных нет.

create or replace function public.portal_quality_objection_stats(
  p_from date,
  p_to date,
  p_project text default null,
  p_kind text default null
)
returns table (
  objection text,
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
    r.objection,
    count(*) as reviews_count,
    count(*) filter (where r.total_score is not null) as scored_count,
    round(avg(r.total_score), 2) as avg_total
  from public.quality_reviews r
  where public.portal_can_view_section('quality')
    and public.portal_has_project(r.project)
    and r.status = 'completed'
    and r.archived_at is null
    and r.objection is not null
    and btrim(r.objection) <> ''
    and r.review_date >= p_from
    and r.review_date <= p_to
    and (p_project is null or r.project = p_project)
    and (p_kind is null or r.kind = p_kind)
  group by r.objection
  order by count(*) desc, r.objection;
$$;

comment on function public.portal_quality_objection_stats(date, date, text, text) is
  'Возражения кандидатов за период: как часто звучит каждое и с каким средним итогом отрабатывается. Единственный агрегат раздела, который говорит не о работе сотрудников, а о том, что говорят кандидаты. Пустое возражение не учитывается — «не заполнили» и «возражения не было» разные вещи. Черновики и архивные не считаются; право и проектная изоляция проверяются внутри запроса.';

revoke execute on function public.portal_quality_objection_stats(date, date, text, text) from public;
revoke execute on function public.portal_quality_objection_stats(date, date, text, text) from anon;
grant execute on function public.portal_quality_objection_stats(date, date, text, text) to authenticated;
