-- TASK-013: шаблоны проверок раздела «Контроль качества».
--
-- Три таблицы — шаблон, блок, пункт. Заполненные проверки лежат отдельно
-- (20260818100200), и это разделение принципиально: правка шаблона не
-- должна менять оценку, которую кто-то уже получил.
--
-- Почему один движок на два процесса. Сегодня в работе две таблицы:
-- «Самоотказы КЦ» (4 критерия, без блоков) и «Чек-листы по проектам»
-- (35–40 пунктов в 9 блоках, свой лист на проект). Вторая — обобщение
-- первой: самоотказ описывается тем же шаблоном с одним блоком. Различает
-- их `kind`; двух наборов таблиц, двух редакторов и двух формул расчёта
-- не заводится.
--
-- RLS включается здесь, политики добавляются в 20260818100300 — тот же
-- двухшаговый порядок, что у public.candidates / public.addresses /
-- public.vacancy_projects.

-- Шаблон -----------------------------------------------------------------
create table public.quality_checklists (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) > 0),

  -- 'call'    — оценка звонка целиком по чек-листу проекта;
  -- 'refusal' — проверка лида, закрытого самоотказом.
  -- text + CHECK, а не enum: расширить список видов проверок должно быть
  -- можно без ALTER TYPE (тот же принцип, что у rates.unit/schedule).
  kind text not null check (kind in ('call', 'refusal')),

  -- NULL — общий шаблон вида, действует для любого проекта. Непустое
  -- значение — шаблон конкретного проекта, тот же свободный текст со
  -- справочником candidate_list_options (list_type = project), что и в
  -- остальных разделах. Выбор шаблона для новой проверки: сначала шаблон
  -- проекта, при его отсутствии — общий. Из-за этого правила у самоотказов
  -- достаточно одного шаблона на весь портал, а у звонков их восемь.
  project text,

  -- Растёт при каждой правке состава блоков и пунктов (триггеры ниже).
  -- Проверка запоминает версию, по которой её заполняли, поэтому
  -- сохранённая оценка остаётся объяснимой даже после переделки шаблона.
  version integer not null default 1,

  archived_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.portal_users (id) on delete set null,
  created_by_login text,
  updated_by uuid references public.portal_users (id) on delete set null,
  updated_by_login text
);

comment on table public.quality_checklists is
  'Шаблон проверки для раздела «Контроль качества»: чек-лист звонка по проекту (kind = call) или проверка самоотказа (kind = refusal). Заполненные проверки — public.quality_reviews.';
comment on column public.quality_checklists.project is
  'NULL — общий шаблон вида (используется, когда у проекта нет своего). Свободный текст со справочником candidate_list_options (list_type = project), как в остальных разделах.';
comment on column public.quality_checklists.version is
  'Версия состава шаблона. Растёт триггером при изменении блоков и пунктов; quality_reviews.checklist_version хранит ту, по которой заполняли проверку.';

-- Один действующий шаблон на пару (вид, проект) и один общий на вид.
-- Частичные индексы, а не unique-ограничение: в Postgres NULL не
-- конфликтует с NULL, поэтому обычное unique (kind, project) пропустило бы
-- два общих шаблона одного вида. Тот же приём, что у
-- portal_section_permissions.
create unique index quality_checklists_kind_project_key
  on public.quality_checklists (kind, project)
  where project is not null and archived_at is null;

create unique index quality_checklists_kind_common_key
  on public.quality_checklists (kind)
  where project is null and archived_at is null;

-- Блок -------------------------------------------------------------------
create table public.quality_checklist_groups (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.quality_checklists (id) on delete cascade,
  title text not null check (char_length(btrim(title)) > 0),
  sort_order integer not null default 0,

  -- false — блок считается, но в итоговый процент не входит. Ровно это
  -- делает сегодня блок «Возражения»: в исходном файле итог — это
  -- AVERAGE по восьми блокам, а девятый вынесен в отдельную сводную, о чём
  -- прямо написано в заголовке колонки «Общий процент (возражения считаем
  -- в отдельной сводной)». Флаг переносит это правило в базу, вместо того
  -- чтобы зашивать название блока в формулу.
  counts_in_total boolean not null default true,

  -- Блоки не удаляются, а архивируются: на их пункты ссылаются прошлые
  -- проверки.
  archived_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Уникальность нужна не только по смыслу: seed-миграция 20260818100600
  -- связывает пункты с блоками по названию, а не по id.
  constraint quality_checklist_groups_title_key unique (checklist_id, title)
);

comment on table public.quality_checklist_groups is
  'Блок пунктов внутри шаблона («Установление контакта», «Возражения», …). Процент блока = сумма баллов / (2 × сумма весов зачтённых пунктов).';
comment on column public.quality_checklist_groups.counts_in_total is
  'Входит ли блок в итоговый процент проверки. false у блока «Возражения» — воспроизводит формулу исходного Excel, где итог считается как среднее по остальным блокам.';

create index quality_checklist_groups_checklist_idx
  on public.quality_checklist_groups (checklist_id, sort_order);

-- Пункт ------------------------------------------------------------------
create table public.quality_checklist_items (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.quality_checklist_groups (id) on delete cascade,
  title text not null check (char_length(btrim(title)) > 0),

  -- '0-1-2' — есть частичное выполнение (в Excel список валидации «1,2,0»);
  -- '0-2'   — только «сделал/не сделал» (список «2,0»);
  -- 'yes_no' — пункт-переключатель: сам баллов не даёт, а включает или
  --            выключает свой блок. Такой пункт в файле один — «Возражение
  --            было?»: при ответе «Нет» остальные пункты блока не
  --            заполняются, и процент блока не считается вовсе.
  scale text not null check (scale in ('0-1-2', '0-2', 'yes_no')),

  weight integer not null default 1 check (weight > 0),

  -- Можно ли отметить пункт как «не применимо». Такой пункт исключается из
  -- знаменателя блока, а не засчитывается нулём. В Excel это состояние
  -- выражалось пустой ячейкой и работало случайно: SUM считает пустое
  -- нулём, AVERAGE — игнорирует.
  allow_na boolean not null default true,

  -- Критическая ошибка: ноль по такому пункту обнуляет итог всей проверки.
  -- В seed 20260818100600 не выставлен ни у одного пункта — иначе
  -- перенесённая история разошлась бы с цифрами исходных файлов.
  is_critical boolean not null default false,

  sort_order integer not null default 0,
  archived_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Переключатель не может быть критической ошибкой: он не даёт баллов, и
  -- обнулять по нему нечего.
  constraint quality_checklist_items_gate_not_critical
    check (not (is_critical and scale = 'yes_no'))
);

comment on table public.quality_checklist_items is
  'Пункт чек-листа. Балл 0/1/2 по шкале, вес, признак «можно не применять» и признак критической ошибки.';
comment on column public.quality_checklist_items.scale is
  'Шкала: 0-1-2 (есть частичное выполнение), 0-2 (только да/нет), yes_no (пункт-переключатель блока, баллов не даёт).';
comment on column public.quality_checklist_items.is_critical is
  'Ноль по такому пункту обнуляет итог всей проверки. В засеянных из Excel шаблонах не используется — там такого правила не было.';

create index quality_checklist_items_group_idx
  on public.quality_checklist_items (group_id, sort_order);

-- Аудит и версия ---------------------------------------------------------
-- Кто/когда — снимком в самой строке, как у addresses/rate_cards/
-- vacancy_projects: portal_users полностью закрыта RLS для authenticated,
-- поэтому login копируется текстом, а функция объявлена security definer,
-- чтобы его прочитать.
create function public.set_quality_checklists_audit_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.portal_current_user_id();
  v_login text;
begin
  if v_uid is not null then
    select login into v_login from public.portal_users where id = v_uid;
  end if;

  if tg_op = 'INSERT' then
    new.created_by := v_uid;
    new.created_by_login := v_login;
  else
    new.created_by := old.created_by;
    new.created_by_login := old.created_by_login;
  end if;

  new.updated_by := v_uid;
  new.updated_by_login := v_login;
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_quality_checklists_set_audit_fields
  before insert or update on public.quality_checklists
  for each row
  execute function public.set_quality_checklists_audit_fields();

create trigger trg_quality_checklist_groups_set_updated_at
  before update on public.quality_checklist_groups
  for each row
  execute function public.set_candidates_updated_at();

create trigger trg_quality_checklist_items_set_updated_at
  before update on public.quality_checklist_items
  for each row
  execute function public.set_candidates_updated_at();

-- Версия шаблона поднимается автоматически при любой правке состава.
-- Делать это в приложении означало бы полагаться на дисциплину вызывающего:
-- версия нужна именно там, где кто-то поменял чек-лист неожиданно для
-- заполняющего проверку.
create function public.bump_quality_checklist_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_checklist_id uuid;
begin
  if tg_table_name = 'quality_checklist_groups' then
    v_checklist_id := coalesce(new.checklist_id, old.checklist_id);
  else
    select g.checklist_id into v_checklist_id
    from public.quality_checklist_groups g
    where g.id = coalesce(new.group_id, old.group_id);
  end if;

  if v_checklist_id is not null then
    update public.quality_checklists
    set version = version + 1
    where id = v_checklist_id;
  end if;

  return coalesce(new, old);
end;
$$;

comment on function public.bump_quality_checklist_version() is
  'Поднимает quality_checklists.version при изменении состава блоков или пунктов. Правки самой строки шаблона (название, архивация) версию не двигают — оптимистическая блокировка сторожит состав, а не заголовок.';

create trigger trg_quality_checklist_groups_bump_version
  after insert or update or delete on public.quality_checklist_groups
  for each row
  execute function public.bump_quality_checklist_version();

create trigger trg_quality_checklist_items_bump_version
  after insert or update or delete on public.quality_checklist_items
  for each row
  execute function public.bump_quality_checklist_version();

alter table public.quality_checklists enable row level security;
alter table public.quality_checklist_groups enable row level security;
alter table public.quality_checklist_items enable row level security;
