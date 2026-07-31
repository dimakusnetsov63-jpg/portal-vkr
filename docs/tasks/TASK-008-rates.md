# TASK-008 Раздел «Ставки»

## Цель

Полноценный раздел портала для тарифов, по которым персонал работает у
клиента: ставка за час/единицу/смену, доход за смену/неделю/месяц,
зарплатный проект, бонусы, акции, условия оформления. Данные — только
Supabase, без mock-данных и временных массивов; создание, редактирование и
удаление работают через реальную базу.

## Контекст

Источник структуры — рабочая таблица «ВКР Потребность.xlsx» (34 листа, по
листу на клиента: Самокат, Купер, Лента, Магнит, Сберлогистика, Утконос и
т. д.). Excel использован только для проектирования схемы; раздел не
переносит его «как есть» и не импортирует из него данные — это
самостоятельное хранилище с CRUD через интерфейс портала.

## Бизнес-логика

- Внутри каждого клиента строки идут блоками по городу с общими условиями
  на блок (в Excel — объединённые ячейки). Отсюда два уровня: блок условий
  (`rate_cards`, один раз на «проект + город + юр. лицо») и строка тарифа
  (`rates`, должность внутри блока, FK с каскадом).
- Доход за смену/неделю/месяц не хранится — считается на клиенте из ставок
  и графика (`rateMetrics.ts`). Модель смен в неделю/месяц усреднённая по
  графику, не воспроизводит индивидуальные множители исходной таблицы.
  Для `flexible`/`parttime` неделя/месяц — `null`, не `0`.
- `rate_hour_priority` — альтернативная ставка, не складывается с основной.
- `project`/`legal_entity` — свободный текст со справочником
  (`candidate_list_options`), не enum `candidate_project`: список клиентов
  «Ставок» шире (30+), чем в enum (12).
- Удаление — настоящее (`DELETE`), не архив: у устаревшего тарифа нет
  исторической ценности. Удаление блока каскадом уносит его ставки —
  подтверждение называет их число.
- Раздел доступен всем четырём ролям, как «Адреса»/«Уведомления».

Подробности — [`../requirements/rates.md`](../requirements/rates.md).

## Технические изменения

### Database

- `20260731100000_rates_list_types.sql` — значения `project`/`legal_entity`
  в enum `candidate_list_type`.
- `20260731100100_create_rates.sql` — таблицы `rate_cards`/`rates`, FK
  `rates.rate_card_id → rate_cards.id on delete cascade`, text+CHECK для
  `unit`/`schedule`/`office_status`, индексы (включая GIN trigram по
  `position`), общий триггер аудита `set_rates_audit_fields()`, засев 25
  проектов и 11 юр. лиц.
- `20260731100200_rates_rls_policies.sql` — RLS-политики на
  `portal_can('rates')`, включая `delete`.
- `20260731100300_update_portal_role_sections_rates.sql` — `'rates'` во всех
  четырёх ролях `portal_role_sections()`.
- `database.types.ts` регенерирован (`gen types --linked`).

**Backfill не требовался** — новые таблицы, данных до миграции не было.
`onConflict` в репозитории соответствует `unique (project, city,
legal_entity)` на `rate_cards` и `unique (rate_card_id, position)` на
`rates`.

### Backend

- [`rates.types.ts`](../../src/lib/supabase/rates.types.ts) — `RateCardRow/Insert/Update`,
  `RateRow/Insert/Update` (выведены из `database.types.ts`, `extras`
  переопределён поверх `Json`).
- [`ratesRepo.ts`](../../src/lib/supabase/ratesRepo.ts) —
  `listRateCards`, `listRates`, `findOrCreateRateCard` (race-safe upsert +
  чтение по естественному ключу), `updateRateCard`, `deleteRateCard`,
  `createRate`, `updateRate`, `deleteRate`.
- `PortalContext` — состояние `rateCards`/`rates`/`ratesLoading`/`ratesError`
  и обёртки `addRate`/`saveRate`/`deleteRateRecord`/`saveRateCard`/
  `deleteRateCardRecord`, загрузка `listRateCards()` + `listRates()`
  параллельно (`Promise.all`) на монтировании.

### Frontend

- `src/components/portal/sections/rates/`: `RatesSection.tsx` (оркестратор),
  `RatesDashboard.tsx` (8 KPI), `RatesTable.tsx`, `AddRateModal.tsx`,
  `RateDrawer.tsx` (ставка + условия блока в одной карточке),
  `rateFilters.ts`, `rateMetrics.ts` (join + вычисляемые суммы, с тестами),
  `rateOptions.ts`.
- `PortalPage`, `NAV_ITEMS`, `PAGE_TITLES` — новый раздел `rates`.
- `src/lib/auth/roles.ts` — `SECTION_ORDER` и `ROLE_PERMISSIONS` для всех
  четырёх ролей (зеркалит SQL-матрицу).
- `PortalApp.tsx` — `RatesSection`/`RateDrawer` подключены в свитч разделов
  и в список дроверов.
- `candidateOptions.ts` — подписи для новых `list_type` (`project`,
  `legal_entity`) в `LIST_TYPE_LABELS`.

## Acceptance Criteria

- [x] Раздел «Ставки» появился в меню портала, доступен всем четырём ролям
- [x] Структура (два уровня: блок условий + строка тарифа) соответствует
      структуре исходного Excel
- [x] Все данные загружаются из Supabase, без mock-данных и временных массивов
- [x] После обновления страницы (F5) данные сохраняются — подтверждено
      вручную
- [x] Создание, редактирование и удаление ставки работают через интерфейс
- [x] Удаление блока условий каскадом удаляет его ставки, с предупреждением
      о их числе
- [x] Изменения сразу отображаются в интерфейсе без перезагрузки
- [x] Миграции применены к боевой БД, `database.types.ts` регенерирован
- [x] Repository — единственная точка доступа к Supabase; UI и
      `PortalContext` не содержат SQL/запросов
- [x] `npx tsc --noEmit`, `npm run lint`, `npm test` (186 тестов), `npm run build`
      — без ошибок
- [ ] Ручная проверка по [`../testing/checklist.md`](../testing/checklist.md)
      под всеми четырьмя ролями — пройден один ручной прогон (создание,
      правка тарифа, правка условий блока, обновление страницы, удаление),
      полный прогон под каждой ролью отдельно не выполнялся

## Testing

- `rateMetrics.test.ts` — join, `shiftsPerWeek/Month`, `incomePerShift/Week/Month`
  (включая независимость от `rate_hour_priority` и `null` для
  `flexible`/`parttime`), `calculateRateMetrics` (пустая выборка → нули).
- `rateFilters.test.ts` — точные фильтры, многополевой поиск,
  регистронезависимость, отсутствие мутации входных данных.
- `roles.test.ts` — обновлён под добавление `rates` в матрицу прав.
- Ручная проверка — см. Acceptance Criteria.

## Риски

- **Каскадное удаление блока необратимо** — удаляет все ставки блока без
  возможности восстановления (у «Ставок» нет soft-delete). Подтверждение
  называет число затрагиваемых ставок, но это нативный `window.confirm`, не
  модалка портала.
- **Список проектов «Ставок» не синхронизирован** со списком
  `candidate_project` — управляются раздельно, совпадение названий не
  гарантировано после правок в «Настройках».
- Откат — новая миграция, отключающая раздел из `portal_role_sections()` и
  прячущая пункт меню; сами таблицы `rate_cards`/`rates` можно оставить
  (данные не портят остальную схему).

## Документация

- [x] `docs/requirements/rates.md`
- [x] `docs/database/schema.md`, `migrations.md`, `policies.md`
- [x] `docs/architecture/*.md` — архитектура не менялась, правок не потребовалось
- [x] `src/components/portal/sections/rates/README.md`
- [x] `docs/changelog/CHANGELOG.md`
- [x] `docs/README.md` — карта документации
- [x] `docs/testing/checklist.md`, `strategy.md`

## Status

`IN PROGRESS` — код, миграции (применены к боевой БД) и документация
готовы; открыт единственный пункт: ручная проверка по
`testing/checklist.md` под каждой из четырёх ролей по отдельности.
