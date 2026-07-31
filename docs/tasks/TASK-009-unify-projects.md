# TASK-009 Единый список проектов

## Цель

Один управляемый список проектов на весь портал — новый проект добавляется
в «Настройки → Списки → Проекты» и сразу доступен в «Кандидатах»,
«Потребности», «Адресах» и «Ставках», без миграции.

## Контекст

TASK-008 («Ставки») завёл собственный свободный список проектов
(`candidate_list_options`, `list_type = project`), потому что исходная
таблица тарифов клиентов (30+) шире, чем enum `candidate_project`
(12 значений), которым были типизированы `candidates.project`/
`staffing_demand.project`/`addresses.project`. Итог — два списка проектов в
одном портале, зафиксированный как известное ограничение в
`docs/requirements/rates.md`. По итогам ревью раздела принято решение
свести оба списка в один: везде должен работать тот же управляемый
справочник, которым уже пользуются «Ставки».

## Бизнес-логика

- Список проектов — один на портал, редактируется только в
  «Настройки → Списки → Проекты» (`candidate_list_options`, `list_type =
  project`), как города/должности/менеджеры.
- Расширение списка не требует миграции и деплоя — так же, как расширение
  списка городов сегодня.
- Существующие значения `candidate_project` (12 штук) уже входят в общий
  список — при переносе ни одно значение проекта в `candidates`/
  `staffing_demand`/`addresses` не поменялось.
- Деактивация значения в Настройках не трогает уже сохранённые записи —
  тот же принцип, что у города/должности.
- Что **не** должно измениться: сами формы (создание/редактирование
  кандидата, потребности, адреса, ставки) остаются такими же по составу
  полей — меняется только источник списка вариантов и виджет выбора поля
  «Проект» (закрытый `<select>` → `Combobox` со свободным вводом и
  подсказками, тот же, что уже используют город/должность в тех же формах).

## Технические изменения

### Database

- `20260731120000_unify_project_free_text.sql`: `alter column ... type text
  using project::text` на `candidates.project`, `staffing_demand.project`,
  `addresses.project` (были `public.candidate_project`). Индексы и
  `unique`-ограничения, где участвует `project`, пересобираются автоматически
  той же командой. Enum `candidate_project` не удалён — им ссылается
  `portal_bootstrap_admin()` (см. `docs/database/migrations.md`), но больше
  не используется ни одной колонкой.
- Backfill не требовался: `candidate_list_options` (`list_type = project`)
  уже содержала все 12 значений enum дословно (засеяны в TASK-008).
- `database.types.ts` регенерирован — `project` в `Candidate`/`CandidateInsert`/
  `CandidateUpdate`, `StaffingDemandRow`/`Insert`/`Update`,
  `AddressRow`/`Insert`/`Update` теперь `string`.
- Проверено читающим запросом после применения: 0 строк с `NULL`/пустым
  `project` в `candidates`; ни одно значение `project` ни в одной из трёх
  таблиц не выпадает из `candidate_list_options` (`list_type = project`).

### Backend

- `candidates.types.ts`: удалён `CandidateProject` (был алиас на
  `Database["public"]["Enums"]["candidate_project"]`).
- `candidateOptions.ts`: удалён `CANDIDATE_PROJECTS` (был статический
  экспорт из `Constants.public.Enums.candidate_project`) — список теперь
  только динамический, через `activeListOptions(listOptions, "project")`.
- `staffingDemandRepo.ts`: параметры `project` — `string` вместо
  `CandidateProject`.
- `PortalContext.tsx`: убраны четыре приведения `as CandidateProject` в
  `upsertDemandCell`/`deleteDemandCell`/`addDemandBulk`/`bulkSetDemandCells`
  — стали не нужны.

### Frontend

- Создание (`AddCandidateModal.tsx`, `AddAddressModal.tsx`,
  `AddDemandModal.tsx`): поле «Проект» — `Combobox` вместо `<select>`,
  источник — `activeListOptions(listOptions, "project")`; добавлена
  проверка «проект обязателен» перед сохранением (раньше была не нужна —
  `<select>` с enum всегда имел валидное значение по умолчанию).
- Редактирование (`RealCandidateDrawer.tsx`, `AddressDrawer.tsx`): та же
  замена `<select>` → `Combobox`. Важная причина, а не только
  единообразие: закрытый `<select>` молча теряет значение, если оно
  деактивировано в Настройках после сохранения записи — `Combobox` всегда
  показывает реальное значение поля независимо от текущего состояния списка
  подсказок.
- Фильтры (`CandidatesSection.tsx`, `AddressesSection.tsx`,
  `DemandToolbar.tsx`/`DemandSection.tsx`): остались обычным `<select>`
  («Все проекты» + вариант) — здесь риска потери данных нет, поменялся
  только источник списка.
- `UserFormModal.tsx` (Настройки → Команда и роли): чипы выбора проектов
  сотрудника теперь читают `usePortal().listOptions` вместо статического
  `CANDIDATE_PROJECTS`.
- `LIST_TYPE_LABELS.project`: «Проекты (Ставки)» → «Проекты» — справочник
  больше не специфичен для одного раздела.

## Acceptance Criteria

- [x] Один и тот же список проектов виден и редактируется из «Настройки →
      Списки → Проекты»
- [x] `candidates.project`/`staffing_demand.project`/`addresses.project` —
      `text`, не enum
- [x] Существующие данные не потеряны и не изменились (проверено запросом)
- [x] Новый проект в Настройках сразу доступен в формах всех четырёх
      разделов без деплоя (логически — источник списка общий; визуальное
      подтверждение — открытый пункт ручной проверки)
- [x] `npx tsc --noEmit`, `npm run lint`, `npm test` (186 тестов), `npm run build`
      — без ошибок
- [ ] Ручная проверка в браузере под каждой из четырёх ролей

## Testing

Автотестов на сам список не добавлено — `CANDIDATE_PROJECTS` нигде не был
покрыт тестами напрямую, а `roles.test.ts`/`rateFilters.test.ts`/
`rateMetrics.test.ts` используют литеральные строки-фикстуры проектов,
независимые от источника списка, и прошли без изменений (186/186).

## Риски

- **Необратимость на уровне типа колонки.** `alter column type text`
  технически обратим (`alter column type public.candidate_project using
  project::candidate_project`), но только пока каждое значение `project`
  во всех трёх таблицах совпадает с одним из 12 исходных меток enum —
  после первого же нового значения (например, «Лента» через форму
  кандидата) откат назад станет невозможен без потери данных.
- **`candidate_project` остаётся в схеме неиспользуемым.** Решение
  осознанное (см. `schema.md`), но это неубранный технический долг: enum
  занимает место в списке типов и может ввести в заблуждение при следующей
  ревизии схемы, если не заглянуть в комментарий.

## Документация

- [x] `docs/requirements/rates.md`, `docs/requirements/demand.md`
- [x] `docs/database/schema.md`, `migrations.md`
- [x] `docs/architecture/system.md`
- [x] `src/components/portal/sections/rates/README.md`
- [x] `docs/changelog/CHANGELOG.md`
- [x] `docs/testing/checklist.md`
- [x] `CLAUDE.md` (§6.2)
- [x] `docs/AUDIT-2026-07.md` — помечена решённой находка 4.2

## Status

`IN PROGRESS` — код, миграция (применена к боевой БД, данные проверены) и
документация готовы; открыт один пункт: ручная проверка в браузере под
каждой из четырёх ролей.
