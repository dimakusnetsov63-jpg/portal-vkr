-- TASK-013, фаза B2 аудита (BUG-02): проверка должна показываться такой,
-- какой её заполняли.
--
-- Что было не так. Карточка проверки рисовала ответы, обходя **текущее**
-- дерево шаблона, да ещё и с фильтром `archived_at is null`. Отсюда две
-- разные неприятности:
--
--   * заархивировали пункт — его ответ исчезал из всех прошлых проверок.
--     Данные оставались в базе, но в карточке их не было;
--   * переименовали пункт — в прошлой проверке менялась формулировка
--     вопроса. Человек видел, что «оценка стоит вот за это», хотя спрашивали
--     тогда другое.
--
-- Для раздела, где оценку обсуждают с сотрудником и иногда оспаривают, это
-- подрывает доказательность: сохранённый процент оставался прежним, а его
-- обоснование менялось задним числом.
--
-- Решение — снимок в самой строке ответа. Те же соображения, что и у
-- `quality_reviews.total_score`/`group_scores`: правка шаблона не должна
-- переписывать прошлое (ADR-006). Разница лишь в том, что там снимали
-- числа, а здесь — тексты и порядок.
--
-- Пять колонок, а не одна `item_title`, потому что карточка должна уметь
-- нарисовать проверку **целиком** без обращения к шаблону: блоки с их
-- названиями и порядком, пункты внутри блока в своём порядке. Иначе
-- группировка и сортировка снова поехали бы за текущим состоянием
-- шаблона — то есть половина бага осталась бы на месте.
--
-- Backfill берёт значения из шаблона as-is: для уже сохранённых проверок
-- это лучшее доступное приближение (шаблоны с момента их создания не
-- переименовывались — проверено перед применением).

alter table public.quality_review_scores
  add column item_title text,
  add column group_id uuid,
  add column group_title text,
  add column group_sort_order integer,
  add column item_sort_order integer;

comment on column public.quality_review_scores.item_title is
  'Формулировка пункта на момент сохранения проверки. Снимок, а не ссылка: правка шаблона не должна менять то, что видно в прошлой проверке (B2, ADR-006).';
comment on column public.quality_review_scores.group_id is
  'Блок, к которому относился пункт. Нужен, чтобы сопоставить ответ с процентом блока из quality_reviews.group_scores без обращения к шаблону.';

-- Backfill из текущего состояния шаблона. Архивные пункты тоже попадают:
-- фильтра по archived_at здесь нет и быть не должно — ответ на архивный
-- пункт остаётся частью истории проверки.
update public.quality_review_scores s
set item_title = i.title,
    group_id = g.id,
    group_title = g.title,
    group_sort_order = g.sort_order,
    item_sort_order = i.sort_order
from public.quality_checklist_items i
join public.quality_checklist_groups g on g.id = i.group_id
where i.id = s.item_id;

-- После backfill колонки обязательны: строка ответа без снимка — это
-- ровно та ситуация, от которой миграция избавляется.
alter table public.quality_review_scores
  alter column item_title set not null,
  alter column group_id set not null,
  alter column group_title set not null,
  alter column group_sort_order set not null,
  alter column item_sort_order set not null;

alter table public.quality_review_scores
  add constraint quality_review_scores_item_title_len check (char_length(item_title) <= 500),
  add constraint quality_review_scores_group_title_len check (char_length(group_title) <= 200);

-- Индекс под чтение карточки: ответы одной проверки в порядке показа.
create index quality_review_scores_review_order_idx
  on public.quality_review_scores (review_id, group_sort_order, item_sort_order);
