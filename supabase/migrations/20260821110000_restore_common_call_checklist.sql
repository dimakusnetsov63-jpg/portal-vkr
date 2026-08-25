-- Возврат общего чек-листа звонка.
--
-- ЧТО СЛУЧИЛОСЬ. Общий шаблон «Прослушка КЦ» (project is null) был
-- единственным чек-листом звонка на весь портал. В редакторе у него сменили
-- проект на «Газпромнефть» — и шаблон не скопировался, а переехал: строка
-- одна, у неё просто стало другое значение project. В результате у
-- «Газпромнефти» появился свой чек-лист, а у остальных двадцати с лишним
-- проектов не осталось никакого, и завести по ним проверку стало нельзя.
--
-- Смена проекта у сохранённого шаблона — законное действие (исправить
-- ошибку), но по умолчанию человек ждёт от неё не переноса. Ловушка
-- закрывается в интерфейсе отдельно: редактор теперь предупреждает, что
-- шаблон перестанет применяться к прежнему проекту, и подсказывает кнопку
-- «Копировать».
--
-- ЧТО ДЕЛАЕТ ЭТА МИГРАЦИЯ. Возвращает общий шаблон, не трогая работу,
-- вложенную в «Газпромнефть» (94 версии правок — там уже критерии АЗС, и
-- общими они не являются).
--
-- Состав копируется из архивного «Чек-лист звонка — Самокат» — того самого
-- источника, из которого общий шаблон собирали 19 августа
-- (`20260819100200`). Перепечатывать текст заново нельзя: он выверен, и
-- любое расхождение здесь — это расхождение в оценке живого человека.
--
-- Заодно применяется правило от 20 августа (`20260820170000`): у
-- переключателя блока «н/д» быть не должно — вопрос «было или нет» третьего
-- состояния не имеет. В архивном источнике этой правки нет, он старше.

with src as (
  select id
  from public.quality_checklists
  where kind = 'call'
    and project = 'Самокат'
    and title = 'Чек-лист звонка — Самокат'
  limit 1
), created as (
  insert into public.quality_checklists (title, kind, project)
  select 'Прослушка КЦ', 'call', null
  from src
  -- Идемпотентность: если общий шаблон звонка уже есть, миграция не делает
  -- ничего. Частичный уникальный индекс не даёт завести второй, и падать на
  -- повторном применении она не должна.
  where not exists (
    select 1 from public.quality_checklists
    where kind = 'call' and project is null and archived_at is null
  )
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
select
  copied_groups.id,
  i.title,
  i.scale,
  i.weight,
  -- Переключатель блока «н/д» не принимает.
  case when i.scale = 'yes_no' then false else i.allow_na end,
  i.is_critical,
  i.sort_order
from src
join public.quality_checklist_groups og on og.checklist_id = src.id
join public.quality_checklist_items i on i.group_id = og.id
join copied_groups on copied_groups.title = og.title
where i.archived_at is null;

comment on column public.quality_checklists.project is
  'Проект, к которому применяется шаблон. NULL — общий шаблон вида проверки: он берётся для тех проектов, у которых своего нет. Проектный шаблон всегда важнее общего. Смена значения у существующей строки переносит шаблон, а не копирует его — интерфейс об этом предупреждает.';
