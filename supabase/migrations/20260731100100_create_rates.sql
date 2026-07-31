-- Схема раздела «Ставки» — тарифы, по которым персонал работает у клиента.
--
-- Структура снята с рабочей таблицы «ВКР Потребность.xlsx» (34 листа, по
-- листу на клиента), но проектируется как самостоятельное хранилище, а не
-- как промежуточный слой под импорт: Excel больше нигде не участвует,
-- пользователь заводит и правит ставки прямо в портале.
--
-- В исходной таблице строки идут блоками по городу, и в каждом блоке
-- объединёнными ячейками заданы условия, общие для всех строк блока
-- (зарплатный проект, бонусы, акции, надбавки, менеджер, работа офиса).
-- Замер по листу «Самокат»: 620 строк тарифа, 96 блоков, в среднем 6.5
-- строки на блок — и всего 13 уникальных текстов «Бонусы» на все 620 строк.
--
-- Отсюда два уровня:
--   public.rate_cards — блок «проект + город + юр. лицо» с общими условиями;
--   public.rates      — строка тарифа по должности внутри блока.
--
-- Условия хранятся один раз на блок. Плоская таблица потребовала бы
-- переписывать один и тот же текст бонуса в 15 строках при каждой правке —
-- строки одного города со временем разошлись бы, и ничто бы об этом не
-- сообщило. Связь — настоящий FK с каскадом, а не естественный ключ:
-- переименование города в блоке должно уносить за собой все его ставки, а
-- строк-сирот быть не должно.
--
-- `project`, `city`, `legal_entity`, `position`, `manager` — свободный текст
-- с подсказками из public.candidate_list_options (list_type = project /
-- city / legal_entity / position / manager). `project` намеренно НЕ enum
-- public.candidate_project — обоснование в 20260731100000_rates_list_types.sql.
--
-- Производные суммы (за смену, за неделю, за месяц) в базе НЕ хранятся:
-- считаются на клиенте из ставок и графика (rateMetrics.ts) — тем же
-- принципом, что дефицит и укомплектованность в «Адресах». В Excel это
-- формулы; хранение их результата означало бы держать в базе число, которое
-- расходится с собственными ставками при первой же их правке.
--
-- unit / schedule / office_status — text + CHECK, а не enum: бизнес
-- расширяет эти списки, а CHECK переопределяется одной миграцией, в отличие
-- от `alter type ... add value`, которое нельзя использовать в той же
-- транзакции (то же обоснование, что у staffing_demand_rows.status и
-- addresses.object_type).
--
-- RLS включается здесь без политик — политики добавляет
-- 20260731100200_rates_rls_policies.sql, тем же двухшаговым порядком, что
-- public.candidates и public.addresses.

-- Блок условий ---------------------------------------------------------

create table public.rate_cards (
  id uuid primary key default gen_random_uuid(),

  project text not null,
  city text not null,
  -- not null default '', а не nullable: юр. лицо входит в ключ уникальности
  -- блока, а NULL в Postgres не равен NULL — два блока «без юр. лица» в
  -- одном городе перестали бы конфликтовать и разъехались бы условиями.
  legal_entity text not null default '',

  -- Зарплатные проекты: {'ВТБ','ГПБ','Т-Банк'}. Массив, а не текст — в
  -- исходной таблице почти всегда перечислено несколько банков сразу.
  -- Подписи и порядок живут на клиенте (rateOptions.ts): новый банк не
  -- требует миграции.
  payroll_banks text[] not null default '{}',

  bonuses text check (bonuses is null or char_length(bonuses) <= 4000),
  promotions text check (promotions is null or char_length(promotions) <= 4000),
  surcharges text check (surcharges is null or char_length(surcharges) <= 4000),
  hiring_conditions text check (hiring_conditions is null or char_length(hiring_conditions) <= 4000),
  notes text check (notes is null or char_length(notes) <= 4000),

  manager text,

  office_status text not null default 'unknown'
    check (office_status in ('working', 'not_working', 'unknown')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Снимок «кто/когда» прямо в строке — как в public.addresses. `*_login`
  -- текстом, потому что public.portal_users полностью закрыта RLS для роли
  -- `authenticated`: join из клиента не смог бы разрешить имя.
  created_by uuid references public.portal_users (id) on delete set null,
  created_by_login text,
  updated_by uuid references public.portal_users (id) on delete set null,
  updated_by_login text,

  unique (project, city, legal_entity)
);

comment on table public.rate_cards is
  'Блок условий раздела «Ставки»: проект + город + юр. лицо. Зарплатные проекты, бонусы, акции, надбавки, условия оформления, менеджер, работа офиса — хранятся один раз на блок и общие для всех его ставок (public.rates).';
comment on column public.rate_cards.legal_entity is
  'Пустая строка = юр. лицо не указано. Не NULL, потому что поле входит в unique (project, city, legal_entity), а NULL с NULL в уникальном индексе не конфликтует.';
comment on column public.rate_cards.payroll_banks is
  'Слаги банков зарплатного проекта, например {vtb,gpb,tbank}. Подписи — в rateOptions.ts, новый банк не требует миграции.';
comment on column public.rate_cards.office_status is
  'working | not_working | unknown — колонка «Работа офиса» исходной таблицы. unknown = не заполнено, состояние по умолчанию, а не отдельный бизнес-статус.';

-- Строка тарифа --------------------------------------------------------

create table public.rates (
  id uuid primary key default gen_random_uuid(),

  -- Каскад намеренный: ставка вне своего блока не имеет смысла — у неё не
  -- было бы ни города, ни проекта, ни условий.
  rate_card_id uuid not null references public.rate_cards (id) on delete cascade,

  position text not null,

  unit text not null default 'hour'
    check (unit in ('hour', 'hour_order', 'hour_item', 'order', 'stop', 'shift', 'day', 'route')),

  -- Основная и приоритетная ставки за час: в исходной таблице это одна
  -- колонка вида «235/255», то есть два числа, а не одно.
  rate_hour numeric check (rate_hour is null or rate_hour >= 0),
  rate_hour_priority numeric check (rate_hour_priority is null or rate_hour_priority >= 0),

  -- Сдельная часть. Что считать единицей — заказ, стоп, собранный товар или
  -- поездку — задаёт `unit`; отдельной колонки под вид единицы нет
  -- намеренно, иначе два поля описывали бы одно и то же.
  rate_piece numeric check (rate_piece is null or rate_piece >= 0),
  pieces_per_shift numeric check (pieces_per_shift is null or pieces_per_shift >= 0),

  -- Фиксированная оплата за смену/сутки/маршрут, если она есть помимо
  -- почасовой и сдельной части.
  rate_shift numeric check (rate_shift is null or rate_shift >= 0),

  shift_hours numeric not null default 12 check (shift_hours > 0 and shift_hours <= 24),

  -- Средняя сумма надбавок за смену: в исходной таблице это отдельный
  -- вводимый столбец, а не расчёт.
  surcharge_per_shift numeric check (surcharge_per_shift is null or surcharge_per_shift >= 0),

  -- График нужен только для пересчёта смены в неделю и месяц. Тот же
  -- словарь, что addresses.schedule_type.
  schedule text
    check (schedule is null or schedule in ('2/2', '3/3', '5/2', '6/1', '7/0', 'flexible', 'parttime')),

  -- Показатели, которые есть у части клиентов и бессмысленны у остальных:
  -- оплата за стоп SLA 15 / SLA 30+, доплата за вес и порог веса, топливная
  -- карта, надбавка за стаж. Отдельными колонками это дало бы десяток полей,
  -- пустых у большинства строк, и новую миграцию на каждого следующего
  -- клиента. Формат: [{"id","label","value"}, …].
  extras jsonb not null default '[]',

  comment text check (comment is null or char_length(comment) <= 4000),

  -- Порядок должностей внутри блока: в исходной таблице он осмысленный
  -- (базовый профиль, затем приоритетный), алфавит его ломает.
  sort_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  created_by uuid references public.portal_users (id) on delete set null,
  created_by_login text,
  updated_by uuid references public.portal_users (id) on delete set null,
  updated_by_login text,

  -- Одна должность встречается в блоке ровно один раз: это и есть строка
  -- тарифа. Приоритетный профиль — отдельная должность («вело-курьер
  -- (приоритет)»), а не второе значение той же.
  unique (rate_card_id, position)
);

comment on table public.rates is
  'Строка тарифа раздела «Ставки»: должность внутри блока public.rate_cards. Суммы за смену/неделю/месяц не хранятся — считаются на клиенте (rateMetrics.ts).';
comment on column public.rates.unit is
  'Единица измерения тарифа. Она же задаёт, что считать единицей в rate_piece: заказ, стоп, собранный товар или поездку.';
comment on column public.rates.extras is
  'Показатели, специфичные для отдельных клиентов (оплата за стоп SLA, доплата за вес, топливная карта…). Формат: [{"id","label","value"}, …]. Вынесены в jsonb, чтобы новый клиент со своим показателем не требовал миграции.';
comment on column public.rates.sort_order is
  'Порядок должностей внутри блока. Одинаковые значения допустимы — тогда порядок доопределяется по position (см. ratesRepo.listRates).';

-- Аудит ----------------------------------------------------------------
-- Проставляет created_by/updated_by и updated_at на обеих таблицах.
-- SECURITY DEFINER нужен, чтобы прочитать portal_users.login: для роли
-- `authenticated` у этой таблицы нет ни одной SELECT-политики. То же
-- обоснование, что у public.set_addresses_audit_fields().

create function public.set_rates_audit_fields()
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

create trigger trg_rate_cards_set_audit_fields
  before insert or update on public.rate_cards
  for each row
  execute function public.set_rates_audit_fields();

create trigger trg_rates_set_audit_fields
  before insert or update on public.rates
  for each row
  execute function public.set_rates_audit_fields();

-- Индексы --------------------------------------------------------------

create index idx_rate_cards_project on public.rate_cards (project);
create index idx_rate_cards_city on public.rate_cards (city);
create index idx_rate_cards_legal_entity on public.rate_cards (legal_entity);
create index idx_rate_cards_manager on public.rate_cards (manager);
create index idx_rate_cards_office_status on public.rate_cards (office_status);

-- Под join строк со своим блоком — самый частый доступ в разделе.
create index idx_rates_rate_card_id on public.rates (rate_card_id);
create index idx_rates_position on public.rates (position);
create index idx_rates_unit on public.rates (unit);
-- pg_trgm включён миграцией кандидатов; нужен для подстрокового поиска по
-- должности в общей строке поиска раздела.
create index idx_rates_position_trgm on public.rates using gin (position gin_trgm_ops);

alter table public.rate_cards enable row level security;
alter table public.rates enable row level security;
-- Политик здесь нет намеренно — см. 20260731100200_rates_rls_policies.sql.

-- Справочники подсказок для новых полей раздела ------------------------
-- Проекты: сначала 12 значений enum candidate_project — чтобы два списка
-- проектов в портале начинались с одинакового набора, — затем клиенты,
-- которые есть в исходной таблице ставок, но в enum не входят. Дальше
-- список ведёт бизнес в «Настройки → Списки», без миграций.
insert into public.candidate_list_options (list_type, value, sort_order, is_active)
values
  ('project', 'Самокат', 0, true),
  ('project', 'Купер', 1, true),
  ('project', 'ДонатсКофе', 2, true),
  ('project', 'Яндекс Лавка', 3, true),
  ('project', 'Яндекс РБ', 4, true),
  ('project', 'Газпромнефть', 5, true),
  ('project', 'Евроторг', 6, true),
  ('project', 'Мастер Деливери', 7, true),
  ('project', 'Мастер Деливери Таксопарк', 8, true),
  ('project', 'Азбука вкуса', 9, true),
  ('project', 'Бургер кинг Россия', 10, true),
  ('project', 'Далли', 11, true),
  ('project', 'Х5', 12, true),
  ('project', 'Х5 Впрок', 13, true),
  ('project', 'Лента', 14, true),
  ('project', 'Магнит', 15, true),
  ('project', 'Сберлогистика', 16, true),
  ('project', 'Утконос', 17, true),
  ('project', 'Кухня на районе', 18, true),
  ('project', 'Милти', 19, true),
  ('project', 'Кранчи Дрим', 20, true),
  ('project', 'МиаВендинг', 21, true),
  ('project', 'Додо Пицца', 22, true),
  ('project', 'Джой Пицца', 23, true),
  ('project', 'Русский Хлеб', 24, true)
on conflict (list_type, value) do nothing;

-- Юр. лица — из той же исходной таблицы.
insert into public.candidate_list_options (list_type, value, sort_order, is_active)
values
  ('legal_entity', 'Служба Доставки', 0, true),
  ('legal_entity', 'Ракета', 1, true),
  ('legal_entity', 'Я Доставка', 2, true),
  ('legal_entity', 'Азбука Логистики', 3, true),
  ('legal_entity', 'Система Логистики', 4, true),
  ('legal_entity', 'Экспресс Плюс', 5, true),
  ('legal_entity', 'Специалист', 6, true),
  ('legal_entity', 'Сервис Логистика', 7, true),
  ('legal_entity', 'Пятая Передача', 8, true),
  ('legal_entity', 'Логистические Традиции', 9, true),
  ('legal_entity', 'Сервис Транс Экспедиция', 10, true)
on conflict (list_type, value) do nothing;
