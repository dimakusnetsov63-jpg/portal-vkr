-- Импорт потребности пишет в «Адреса», а не в «Потребность».
--
-- Изначально (20260805110000) загрузка Excel писала строки в
-- public.staffing_demand — матрицу «проект+город+должность+дата». На
-- практике оказалось, что бизнесу нужен другой результат: список объектов
-- в разделе «Адреса» с заполненным required_count, где один открытый тикет
-- = один требуемый человек, а дата тикета («Обновлено» в выгрузке Лавки) —
-- не измерение данных, а лишь техническая отметка источника. Поэтому
-- addresses получает те же две служебные колонки, что уже есть у
-- staffing_demand: чем создана строка и каким импортом.
--
-- Уникального индекса по (project, city, full_address, position) здесь
-- намеренно нет: в таблице уже могут быть заведённые вручную карточки с
-- совпадающими значениями, и добавление constraint'а сломало бы миграцию
-- на боевых данных. Сопоставление «эта строка файла = вот эта карточка»
-- делается в приложении (importDemand.ts читает существующие карточки
-- проекта и матчит по этому ключу в памяти), поэтому повторный импорт того
-- же файла обновляет карточки, а не плодит дубликаты.

-- `if not exists` — потому что миграции этого проекта применяются руками
-- через SQL Editor, без раннера, который отслеживал бы «применено/нет».
-- Повторный запуск не должен падать с `42701: column already exists`.
alter table public.addresses
  add column if not exists source text not null default 'manual' check (source in ('manual', 'excel')),
  add column if not exists import_id uuid references public.staffing_demand_imports(id) on delete set null;

comment on column public.addresses.source is
  'Как появилась карточка: manual — заведена руками через «Добавить адрес», excel — создана импортом потребности (см. staffing_demand_imports).';
comment on column public.addresses.import_id is
  'Импорт (staffing_demand_imports), которым создана эта карточка. NULL — заведена руками. Используется для отмены последнего импорта (src/lib/imports/revertImport.ts).';

create index if not exists idx_addresses_import_id on public.addresses (import_id);
