-- Инфраструктура импорта потребности из Excel (раздел «Адреса»).
--
-- ТЗ требует ключ уникальности «Проект+Город+Должность+Дата+Адрес» (сейчас
-- у staffing_demand ключ без адреса) и историю импортов с деталями. Плюс
-- признак источника строки (ручной ввод / Excel) и ссылка на импорт для
-- последующего отката.
--
-- address — text NULL, а не text NOT NULL DEFAULT ''. NULL здесь означает
-- «строка потребности не привязана к конкретному адресу» (весь текущий UI
-- матрицы «Потребность» именно такой — group by project/city/position/date
-- без адреса); пустая строка означала бы «адрес указан, но пуст», что не то
-- же самое. Postgres не считает NULL конфликтующим с NULL в unique-индексе,
-- поэтому старые строки (все с address is null) остаются взаимно уникальными
-- по (project, city, position, demand_date) — ровно как раньше, без миграции
-- данных. Строки, пришедшие из Excel с реальным адресом, участвуют в новом
-- ключе с непустым address.

alter table public.staffing_demand
  add column address text null,
  add column source text not null default 'manual' check (source in ('manual', 'excel'));

comment on column public.staffing_demand.address is
  'Адрес (улица/дом), к которому относится строка потребности — заполняется импортом из Excel. NULL = потребность не привязана к конкретному адресу (весь ручной ввод и вся текущая матрица «Потребность» до этой миграции).';
comment on column public.staffing_demand.source is
  'Как появилась строка: manual — введена руками в матрице «Потребность», excel — создана/обновлена импортом (см. staffing_demand_imports).';

alter table public.staffing_demand
  drop constraint staffing_demand_project_city_position_demand_date_key;

alter table public.staffing_demand
  add constraint staffing_demand_unique_key
  unique (project, city, position, demand_date, address);

-- Конфигурация парсера по проекту -----------------------------------------
-- Раздельно от кода: подключение нового проекта или смена формата его Excel
-- (например, Лавка поменяет вёрстку выгрузки) — это правка строки в этой
-- таблице (новый parser_key/column_mapping/version), не правка кода.
create table public.project_import_configs (
  id uuid primary key default gen_random_uuid(),
  project text not null,
  parser_key text not null,
  column_mapping jsonb not null,
  enabled boolean not null default true,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (project, parser_key)
);

comment on table public.project_import_configs is
  'Какой парсер и какой маппинг колонок Excel использовать для проекта при импорте потребности (src/lib/imports/parsers). Смена формата файла проекта = новая строка/новый parser_key здесь, без изменения кода.';
comment on column public.project_import_configs.column_mapping is
  'Заголовки колонок исходного Excel-файла для полей единого формата: {"city": "...", "address": "...", "position": "...", "demand": "...", "date": "..."}.';

create trigger trg_project_import_configs_set_updated_at
  before update on public.project_import_configs
  for each row
  execute function public.set_candidates_updated_at();

-- История импортов ---------------------------------------------------------
create table public.staffing_demand_imports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid references public.portal_users(id) on delete set null,
  created_by_login text,

  project text not null,
  parser_key text not null,
  parser_version integer not null,
  file_name text not null,

  mode text not null check (mode in ('replace', 'add')),
  dry_run boolean not null default false,

  total_rows integer not null default 0,
  imported_rows integer not null default 0,
  error_rows integer not null default 0,
  new_rows integer not null default 0,
  updated_rows integer not null default 0,

  status text not null check (status in ('success', 'partial', 'failed', 'reverted')),
  duration_ms integer not null default 0,

  error_log jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb
);

comment on table public.staffing_demand_imports is
  'Журнал загрузок потребности из Excel: кто, когда, каким парсером, сколько строк обработано/импортировано/с ошибками, полный error_log/warnings. created_by_login — снимок логина на момент импорта (переживает переименование/удаление учётки, как portal_audit_log.actor_login).';

create index idx_staffing_demand_imports_created_at on public.staffing_demand_imports (created_at desc);
create index idx_staffing_demand_imports_project on public.staffing_demand_imports (project, created_at desc);

alter table public.staffing_demand
  add column import_id uuid references public.staffing_demand_imports(id) on delete set null;

comment on column public.staffing_demand.import_id is
  'Импорт (staffing_demand_imports), которым создана/обновлена эта строка. NULL — строка введена руками. Используется для отмены последнего импорта (src/lib/imports/revertImport.ts).';

create index idx_staffing_demand_import_id on public.staffing_demand (import_id);

-- Row Level Security ---------------------------------------------------
-- Та же модель, что и у остальных head/coordinator-only письменных
-- операций портала (см. vacancy_projects RLS, 20260805100500):
-- portal_can('addresses') для видимости раздела + portal_can('settings')
-- как гейт на запись, потому что отдельного уровня прав «кто пишет» внутри
-- одной секции в этом проекте не существует.

alter table public.project_import_configs enable row level security;
alter table public.staffing_demand_imports enable row level security;

create policy "portal_select_project_import_configs"
  on public.project_import_configs for select to authenticated
  using (public.portal_can('addresses') and public.portal_can('settings'));

create policy "portal_write_project_import_configs"
  on public.project_import_configs for all to authenticated
  using (public.portal_can('addresses') and public.portal_can('settings'))
  with check (public.portal_can('addresses') and public.portal_can('settings'));

create policy "portal_select_staffing_demand_imports"
  on public.staffing_demand_imports for select to authenticated
  using (public.portal_can('addresses') and public.portal_can('settings'));

create policy "portal_insert_staffing_demand_imports"
  on public.staffing_demand_imports for insert to authenticated
  with check (public.portal_can('addresses') and public.portal_can('settings'));

create policy "portal_update_staffing_demand_imports"
  on public.staffing_demand_imports for update to authenticated
  using (public.portal_can('addresses') and public.portal_can('settings'))
  with check (public.portal_can('addresses') and public.portal_can('settings'));

-- «Яндекс Лавка» — первый проект с полноценным парсером (src/lib/imports/
-- parsers/parser_lavka.ts) под реальную выгрузку тикетов из Yandex Tracker
-- (МСК_31.07.xlsx): город/адрес разбираются из колонки «Задача», должность —
-- из «Теги», потребность считается по открытым (не «Закрыт») тикетам,
-- дата — по колонке «Обновлено» (в файле нет отдельной даты потребности).
-- Остальные три проекта из ТЗ — временно на generic-парсере с одинаковым
-- маппингом колонок, до получения их реальных образцов Excel-файлов (см.
-- docs/requirements/addresses.md, раздел «Импорт потребности»).
--
-- `project` здесь — не свободный текст: он должен буквально совпадать со
-- значением из общего справочника candidate_list_options (list_type =
-- 'project', засеян в 20260731100100_create_rates.sql) — Combobox выбора
-- проекта в ImportDemandModal.tsx строится из этого справочника, и
-- getImportConfigForProject() ищет конфиг по точному значению выбранного
-- проекта. Поэтому — «Яндекс Лавка», «Бургер кинг Россия», «Газпромнефть»,
-- «Купер», а не разговорные «Лавка»/«БК»/«Газпром» из текста ТЗ.
insert into public.project_import_configs (project, parser_key, column_mapping, version) values
  ('Яндекс Лавка', 'lavka_v1', '{"task": "Задача", "position": "Теги", "demand": "Количество вакансий", "date": "Обновлено", "status": "Статус"}'::jsonb, 1),
  ('Бургер кинг Россия', 'bk_v1', '{"city": "Город", "address": "Адрес", "position": "Должность", "demand": "Потребность", "date": "Дата"}'::jsonb, 1),
  ('Газпромнефть', 'gazprom_v1', '{"city": "Город", "address": "Адрес", "position": "Должность", "demand": "Потребность", "date": "Дата"}'::jsonb, 1),
  ('Купер', 'kuper_v1', '{"city": "Город", "address": "Адрес", "position": "Должность", "demand": "Потребность", "date": "Дата"}'::jsonb, 1);
