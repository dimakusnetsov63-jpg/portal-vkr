-- TASK-013: заполненные проверки раздела «Контроль качества».
--
-- Одна строка quality_reviews = одна проверка одного лида: прослушали
-- звонок, проставили баллы по шаблону, получили проценты. Ответы по
-- пунктам — в quality_review_scores.
--
-- Ключевое решение: посчитанные проценты хранятся, а не выводятся на лету.
-- Причин две, и обе весомее экономии на денормализации:
--   1. правка шаблона не должна менять оценку, которую человек уже
--      получил и, возможно, уже обсудил с руководителем;
--   2. реестр за месяц — это до 2765 строк (реальный июнь 2026), а годовая
--      сводка — десятки тысяч; пересобирать их из ответов по пунктам на
--      каждый запрос незачем.
-- Считает проценты база (public.portal_save_quality_review,
-- 20260818100400), а не клиент: иначе итог был бы обычным полем ввода,
-- которому можно послать любое число.

create table public.quality_reviews (
  id uuid primary key default gen_random_uuid(),

  -- restrict, а не cascade: удаление шаблона не должно уносить историю
  -- проверок. Шаблоны и так архивируются, а не удаляются.
  checklist_id uuid not null references public.quality_checklists (id) on delete restrict,
  checklist_version integer not null,
  kind text not null check (kind in ('call', 'refusal')),

  -- Номер лида в CRM (portal.sth-group.ru/crm/lead/details/<id>/). Хранится
  -- числом, ссылка собирается интерфейсом: в исходных файлах лежит полный
  -- URL, и при смене адреса CRM пришлось бы переписывать все строки.
  --
  -- Не уникален намеренно: один лид законно проверяют повторно (в файле
  -- «Самоотказы КЦ» такие есть, например 3605269). Интерфейс предупреждает
  -- о прошлой проверке, но не мешает сохранить.
  crm_lead_id bigint not null check (crm_lead_id > 0),

  project text not null check (char_length(btrim(project)) > 0),

  -- Оцениваемый сотрудник. Учётки в портале у большинства сотрудников КЦ
  -- нет (в файлах 27 имён, в portal_users сейчас две строки), поэтому имя —
  -- обязательный текст, а связь с учётной записью — необязательная. Имя
  -- нормализуется при вводе и при импорте: в исходных таблицах встречаются
  -- дубли вида «Маслюкова Елизавета » с хвостовым пробелом.
  employee_name text not null check (char_length(btrim(employee_name)) > 0),
  employee_user_id uuid references public.portal_users (id) on delete set null,

  -- Проверяющий отдельным полем, а не только created_by_login: при импорте
  -- истории строки создаёт скрипт, а проверяющий в файле свой («Багаутдинова»).
  reviewer_name text not null check (char_length(btrim(reviewer_name)) > 0),

  review_date date not null default current_date,
  call_date date,
  call_type text check (call_type in ('incoming', 'outgoing', 'no_answer')),

  -- Поля, которые сегодня переносятся руками из CRM. Все необязательные:
  -- у проверок самоотказов заполнена одна их часть, у чек-листов — другая.
  position text,
  city text,
  objection text,
  crm_comment text,
  handling_speed text,
  outbound_calls integer check (outbound_calls >= 0),
  is_target boolean,
  violation text,
  recommendations text,

  -- «Кейс в аудиотеку» + «почему и что круто» — вкладка «Аудиотека»
  -- строится фильтром по этому флагу.
  is_case boolean not null default false,
  case_comment text,

  -- draft не попадает в сводки: незаконченная проверка не должна портить
  -- средние. Других состояний пока нет — ознакомление и апелляция
  -- сознательно вынесены за рамки TASK-013.
  status text not null default 'completed' check (status in ('draft', 'completed')),

  -- Итог и проценты по блокам. NULL — «посчитать не из чего» (все пункты
  -- «не применимо», выключенные блоки), это законное состояние, а не ноль:
  -- ноль означает «всё провалено».
  total_score numeric(5, 2) check (total_score >= 0 and total_score <= 100),
  group_scores jsonb not null default '{}'::jsonb,
  has_critical boolean not null default false,

  -- Пакет импорта истории из Excel. Откат импорта = удаление по этому
  -- полю; у проверок, заведённых в портале, оно пустое.
  import_id uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.portal_users (id) on delete set null,
  created_by_login text,
  updated_by uuid references public.portal_users (id) on delete set null,
  updated_by_login text
);

comment on table public.quality_reviews is
  'Заполненная проверка качества: лид, сотрудник, шаблон и посчитанные проценты. Ответы по пунктам — public.quality_review_scores. Пишется только через public.portal_save_quality_review.';
comment on column public.quality_reviews.crm_lead_id is
  'Номер лида в CRM. Не уникален: повторная проверка того же лида законна, интерфейс лишь предупреждает о ней.';
comment on column public.quality_reviews.total_score is
  'Итоговый процент, посчитанный базой при сохранении. NULL — считать было не из чего (ни одного зачтённого блока); это не то же самое, что 0.';
comment on column public.quality_reviews.group_scores is
  'Проценты по блокам на момент сохранения: {"<group_id>": 85.71 | null}. Хранится снимком, чтобы правка шаблона не переписывала прошлые оценки.';
comment on column public.quality_reviews.import_id is
  'Пакет импорта истории из Excel. NULL у проверок, созданных в портале. Откат импорта — delete ... where import_id = ...';

create index quality_reviews_review_date_idx on public.quality_reviews (review_date desc);
create index quality_reviews_project_date_idx on public.quality_reviews (project, review_date desc);
create index quality_reviews_employee_date_idx on public.quality_reviews (employee_name, review_date desc);
create index quality_reviews_lead_idx on public.quality_reviews (crm_lead_id);
create index quality_reviews_checklist_idx on public.quality_reviews (checklist_id);
create index quality_reviews_case_idx on public.quality_reviews (review_date desc) where is_case;
create index quality_reviews_import_idx on public.quality_reviews (import_id) where import_id is not null;

-- Ответ по пункту --------------------------------------------------------
create table public.quality_review_scores (
  review_id uuid not null references public.quality_reviews (id) on delete cascade,

  -- restrict: пункт, на который ссылается хоть одна проверка, физически не
  -- удалить — только заархивировать. Иначе прошлая оценка перестала бы
  -- объясняться.
  item_id uuid not null references public.quality_checklist_items (id) on delete restrict,

  -- 0/1/2 для шкал баллов; для пункта-переключателя 1 = «Да», 0 = «Нет».
  -- NULL вместе с is_na = true — «не применимо».
  value smallint check (value between 0 and 2),
  is_na boolean not null default false,
  note text,

  primary key (review_id, item_id),

  -- «Не применимо» и балл одновременно — противоречие, а не редкий случай.
  constraint quality_review_scores_na_has_no_value
    check (not (is_na and value is not null))
);

comment on table public.quality_review_scores is
  'Ответ по одному пункту чек-листа. Нормализованная таблица, а не jsonb в проверке: вопрос «какой пункт чаще всего проваливают» должен быть обычным group by.';
comment on column public.quality_review_scores.value is
  '0/1/2 по шкале пункта; у пункта-переключателя 1 = «Да», 0 = «Нет». NULL при is_na = true.';

-- Для отчёта «слабые места по пунктам» — обход в обратную сторону.
create index quality_review_scores_item_idx on public.quality_review_scores (item_id);

create function public.set_quality_reviews_audit_fields()
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

create trigger trg_quality_reviews_set_audit_fields
  before insert or update on public.quality_reviews
  for each row
  execute function public.set_quality_reviews_audit_fields();

alter table public.quality_reviews enable row level security;
alter table public.quality_review_scores enable row level security;
