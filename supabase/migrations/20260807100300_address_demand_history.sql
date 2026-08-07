-- Журнал потребности по датам для карточек «Адресов» + функция, которая
-- показывает разделу «Потребность» вычисленное значение там, где оно есть,
-- и ручное — везде остальном.
--
-- public.addresses хранит только ТЕКУЩЕЕ состояние карточки (required_count)
-- — этим импорт не трогается вообще этой миграцией. Но бизнесу нужна ещё и
-- потребность НА ДАТУ (которую пользователь выбирает вручную в форме
-- импорта, не читая из файла) — а хранить снимок на каждую дату в самой
-- addresses означало бы плодить карточки на каждый день. Поэтому — отдельный
-- журнал: один снимок на (адрес, дата), бессрочно, append-only.
--
-- Раздел «Потребность» (public.staffing_demand, ручной ввод) не трогается.
-- Вместо того чтобы писать агрегат из истории обратно в staffing_demand
-- (два источника правды, которые могут разойтись — обсуждалось и отклонено,
-- см. план задачи), результат вычисляется НА ЧТЕНИИ функцией
-- staffing_demand_effective(): для комбинации (project,city,position,date),
-- у которой есть снимки в истории, отдаётся SUM(required_count) по ним;
-- для всех остальных — то, что лежит в staffing_demand как обычно. Значит
-- у 23 из 24 проектов (без Excel-импорта) раздел работает ровно как раньше.

create table public.address_demand_history (
  id uuid primary key default gen_random_uuid(),
  address_id uuid not null references public.addresses(id) on delete cascade,
  project text not null,
  city text not null,
  position text not null,
  demand_date date not null,
  required_count integer not null check (required_count >= 0),
  import_id uuid references public.staffing_demand_imports(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (address_id, demand_date)
);

comment on table public.address_demand_history is
  'Журнал потребности по адресам на конкретную дату — снимок, не текущее состояние (то хранится в addresses.required_count). Пишется только импортом (src/lib/imports/demandHistoryPlan.ts), бессрочно, без автоматического архивирования. project/city/position денормализованы из карточки на момент импорта — это исторический снимок, который не должен задним числом меняться, если карточку потом переименуют.';
comment on column public.address_demand_history.import_id is
  'Импорт (staffing_demand_imports), которым записан этот снимок. NULL после revertImport.ts не предполагается — при откате строка удаляется, а не обезличивается (в отличие от addresses.import_id).';

create trigger trg_address_demand_history_set_updated_at
  before update on public.address_demand_history
  for each row
  execute function public.set_candidates_updated_at();

-- Ведущая колонка — demand_date, не project: staffing_demand_effective()
-- ниже фильтрует ВСЮ историю по диапазону дат без фильтра по проекту
-- (соответствует staffingDemandRepo.listStaffingDemand(fromDate,toDate),
-- который грузит окно сразу по всем проектам — фильтр по проекту в UI
-- применяется на клиенте). Индекс (project, demand_date) был бы бесполезен
-- для такого запроса: Postgres не может использовать составной индекс по
-- второй колонке без равенства по первой.
create index idx_address_demand_history_date on public.address_demand_history (demand_date, project, city, position);
create index idx_address_demand_history_import_id on public.address_demand_history (import_id);

alter table public.address_demand_history enable row level security;

-- select — та же аудитория, что у staffing_demand (portal_can('demand'),
-- НЕ 'addresses'+'settings'): иначе менеджер и рекрутёр (есть 'demand',
-- нет 'settings') не увидели бы вычисленные ячейки в «Потребности» вовсе,
-- хотя видят там всё остальное.
create policy "portal_select_address_demand_history"
  on public.address_demand_history for select to authenticated
  using (public.portal_can('demand') and public.portal_has_project(project));

-- insert/update/delete — пишет только head/coordinator через
-- importDemand.ts/revertImport.ts, и только для своего проекта:
-- `portal_has_project(project)`, как у addresses (H-6,
-- 20260803140000_project_scoped_rls_policies.sql), а не как у
-- staffing_demand_imports (которая project не проверяет вовсе — она
-- завелась до H-6 и с тех пор не пересматривалась). address_demand_history
-- — новая таблица, и её естественный прецедент — addresses (та же колонка
-- project, тот же пайплайн импорта), а не более старая и менее строгая
-- staffing_demand_imports: без этой проверки координатор, ограниченный
-- проектом A, мог бы вставить или удалить снимок истории проекта B, хотя
-- сами карточки addresses проекта B ему уже недоступны.
create policy "portal_insert_address_demand_history"
  on public.address_demand_history for insert to authenticated
  with check (public.portal_can('addresses') and public.portal_can('settings') and public.portal_has_project(project));
create policy "portal_update_address_demand_history"
  on public.address_demand_history for update to authenticated
  using (public.portal_can('addresses') and public.portal_can('settings') and public.portal_has_project(project))
  with check (public.portal_can('addresses') and public.portal_can('settings') and public.portal_has_project(project));
create policy "portal_delete_address_demand_history"
  on public.address_demand_history for delete to authenticated
  using (public.portal_can('addresses') and public.portal_can('settings') and public.portal_has_project(project));

-- Функция, а не VIEW: обе стороны фильтруются по (p_from, p_to) СВОИМ
-- собственным WHERE до соединения — гарантированно, а не в надежде на то,
-- что планировщик протолкнёт предикат через FULL OUTER JOIN (для full join
-- это не такая надёжная оптимизация, как для LEFT/INNER — несовпадающие
-- строки с обеих сторон должны сохраниться). Без этого каждый вызов рисковал
-- агрегировать всю историю целиком, а не только видимое окно, и становился
-- бы медленнее с каждым годом накопленных данных, а не с размером окна.
--
-- FULL OUTER JOIN, а не LEFT JOIN staffing_demand→история: у проекта без
-- единой ручной строки (типичный случай для только что подключённого
-- Excel-импорта) LEFT JOIN от staffing_demand потерял бы всю его
-- потребность целиком — это не вопрос производительности, а прямая потеря
-- данных. И не UNION ALL + NOT EXISTS: тот же результат, но группирующий
-- подзапрос по истории пришлось бы упомянуть дважды в одном запросе.
--
-- language sql без security definer выполняется с правами ВЫЗЫВАЮЩЕГО
-- (стандартное поведение Postgres) — RLS обеих таблиц применяется как
-- обычно, никакого bypass.
-- "position" — зарезервированное слово Postgres (синтаксис POSITION(x IN y)):
-- как обычная колонка таблицы оно проходит без кавычек (см. addresses/
-- candidates/staffing_demand выше), но список колонок RETURNS TABLE
-- разбирается по более строгим правилам ("имя параметра функции"), где
-- зарезервированные слова без кавычек не проходят вовсе — отсюда явные
-- кавычки именно здесь, и только здесь.
create function public.staffing_demand_effective(p_from date, p_to date)
returns table (
  id uuid,
  project text,
  city text,
  "position" text,
  demand_date date,
  planned_count integer,
  source text,
  address text,
  import_id uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
set search_path = public
as $$
  select
    coalesce(m.id, gen_random_uuid()) as id,
    coalesce(h.project, m.project) as project,
    coalesce(h.city, m.city) as city,
    coalesce(h.position, m.position) as position,
    coalesce(h.demand_date, m.demand_date) as demand_date,
    coalesce(h.total, m.planned_count) as planned_count,
    case when h.total is not null then 'excel' else coalesce(m.source, 'manual') end as source,
    m.address,
    coalesce(h.import_id, m.import_id) as import_id,
    coalesce(m.created_at, now()) as created_at,
    coalesce(m.updated_at, now()) as updated_at
  from (select * from public.staffing_demand where demand_date between p_from and p_to) m
  full outer join (
    select project, city, position, demand_date,
           -- sum(integer) в Postgres возвращает bigint, а не integer, но
           -- planned_count в RETURNS TABLE ниже объявлен integer — явный
           -- каст здесь, а не надежда на автоматическое приведение типа
           -- результата функции. Переполнение не грозит: required_count —
           -- уже integer на каждой строке, а группа — несколько десятков
           -- адресов, не миллиарды.
           sum(required_count)::integer as total,
           -- Postgres не регистрирует max(uuid) (в отличие от text/int/
           -- timestamp) — uuid поддерживает операторы сравнения для
           -- сортировки, но не сам агрегат. Каким именно import_id из
           -- нескольких адресов группы отметить в отчёте — произвольно, это
           -- поле нигде не используется бизнес-логикой раздела «Потребность»
           -- (только частью типа StaffingDemandRow), поэтому детерминизм
           -- через text — достаточно, не только обходной путь.
           max(import_id::text)::uuid as import_id
    from public.address_demand_history
    where demand_date between p_from and p_to
    group by project, city, position, demand_date
  ) h
    on h.project = m.project and h.city = m.city and h.position = m.position and h.demand_date = m.demand_date
  order by demand_date;
$$;

comment on function public.staffing_demand_effective(date, date) is
  'То, что реально должен показать раздел «Потребность» за окно [p_from, p_to]: SUM(required_count) из address_demand_history там, где для ключа (project,city,position,date) есть снимки, иначе — обычная ручная строка staffing_demand. История побеждает при коллизии ключа. RLS обеих таблиц применяется как для вызывающего пользователя (SECURITY INVOKER — поведение по умолчанию, ничего специально не включалось).';

-- Postgres по умолчанию даёт EXECUTE на новую функцию роли PUBLIC (то есть
-- и anon). Каждая другая RPC-функция в проекте (portal_can, portal_login,
-- portal_save_vacancy_project_tree и т.д.) явно отзывает этот дефолт и выдаёт
-- права только тем ролям, которым это действительно нужно — здесь этот шаг
-- был упущен. RLS обеих таблиц всё равно не даёт anon увидеть ни одной
-- строки (portal_can('demand') требует существующего portal_users по
-- auth.uid(), которого у anon нет), поэтому дырки в данных это не открывает
-- — но anon не должен и вызывать бизнес-функцию, которая ему заведомо ничего
-- не должна возвращать. Только authenticated, не anon — как у остальных
-- RPC, читающих данные раздела (например, search_vacancy_projects).
revoke execute on function public.staffing_demand_effective(date, date) from public;
grant execute on function public.staffing_demand_effective(date, date) to authenticated;

-- Дата импорта — для отчёта/панели истории; сама функция выше её не
-- использует (дата приходит явно параметрами от клиента). NULL у всех
-- старых записей — колонка появилась позже них.
--
-- `if not exists` — как и в предыдущих трёх миграциях 20260807*: файлы
-- применяются руками через SQL Editor без раннера, отслеживающего
-- «применено/нет», повторный запуск не должен падать с `42701`.
alter table public.staffing_demand_imports add column if not exists demand_date date null;

comment on column public.staffing_demand_imports.demand_date is
  'Дата потребности, выбранная пользователем в форме импорта (не читается из файла) — на неё записан снимок в address_demand_history. NULL у импортов, сделанных до этой колонки.';
