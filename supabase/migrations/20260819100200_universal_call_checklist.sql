-- TASK-013: чек-лист звонка становится единым для всех проектов.
--
-- Решение бизнеса 19 августа 2026: состав пунктов, их количество, поля и
-- логика заполнения одинаковы для всех проектов. Проектных различий в
-- чек-листе нет — как нет их в «Кандидатах» или «Адресах», где проект это
-- просто значение общего справочника, а не отдельная форма.
--
-- Это отменяет исходное допущение засева 20260818100600, где из восьми
-- листов Excel получилось восемь разных шаблонов на 35–40 пунктов. Листы
-- действительно различались (у «Газпрома» был пункт про опыт работы на АЗС,
-- у «Купера» — про наличие смартфона на Android), но различались они
-- потому, что велись разными людьми и в разное время, а не потому, что
-- проверка должна быть разной.
--
-- Механизм для этого уже есть и ничего менять в схеме не нужно: шаблон с
-- `project is null` — общий для вида проверки, он подбирается к любому
-- проекту, у которого нет собственного. До сих пор так работали только
-- самоотказы. Теперь так же работает и чек-лист звонка, а возможность
-- завести проектный шаблон остаётся неиспользованной — на случай, если
-- когда-нибудь понадобится исключение.
--
-- Содержание берётся из шаблона проекта «Самокат»: его 35 пунктов сверены с
-- бизнесом напрямую (миграция 20260819100000) и представляют собой полную
-- девятиблочную структуру. Копируются вместе со шкалами, весами и порядком,
-- а не перепечатываются заново — так исключается расхождение с уже
-- выверенным текстом.
--
-- Шесть проектных чек-листов архивируются, а не удаляются: у них есть
-- пункты, которых нет в общем (АЗС, Android, «работал ли ранее в
-- Самокате»), и если часть из них решат вернуть, восстановление — это
-- снятие `archived_at`, а не повторный разбор Excel. Заполненных проверок
-- по ним нет ни одной, так что архивация ничью оценку не затрагивает.

-- 1. Общий чек-лист звонка — копия структуры выверенного шаблона.
with src as (
  select id from public.quality_checklists
  where kind = 'call' and project = 'Самокат' and archived_at is null
), created as (
  insert into public.quality_checklists (title, kind, project)
  values ('Чек-лист звонка', 'call', null)
  returning id
), copied_groups as (
  insert into public.quality_checklist_groups (checklist_id, title, sort_order, counts_in_total)
  select created.id, g.title, g.sort_order, g.counts_in_total
  from created, src
  join public.quality_checklist_groups g on g.checklist_id = src.id
  where g.archived_at is null
  returning id, title
)
insert into public.quality_checklist_items (group_id, title, scale, weight, allow_na, is_critical, sort_order)
select copied_groups.id, i.title, i.scale, i.weight, i.allow_na, i.is_critical, i.sort_order
from src
join public.quality_checklist_groups og on og.checklist_id = src.id
join public.quality_checklist_items i on i.group_id = og.id
join copied_groups on copied_groups.title = og.title
where i.archived_at is null;

-- 2. Проектные чек-листы звонка уходят в архив. Общий остаётся один и
--    применяется ко всем проектам, включая те 20 из справочника, у которых
--    своего чек-листа никогда и не было.
update public.quality_checklists
set archived_at = now()
where kind = 'call' and project is not null and archived_at is null;

-- 3. Свежий шаблон — первой версии: триггер поднял её на каждой вставке.
update public.quality_checklists
set version = 1
where kind = 'call' and project is null and archived_at is null;

-- 4. Названия — те, которыми пользуется бизнес: «прослушка КЦ» и
--    «прослушка самоотказов». Мои рабочие «Чек-лист звонка» / «Проверка
--    самоотказа» в разговоре не употребляются, а раздел должен называть
--    вещи так же, как люди, которые в нём работают.
update public.quality_checklists
set title = 'Прослушка КЦ'
where kind = 'call' and project is null and archived_at is null;

update public.quality_checklists
set title = 'Прослушка самоотказов'
where kind = 'refusal' and project is null and archived_at is null;
