# Раздел «Кандидаты»

Единственный раздел портала на реальных данных Supabase. Реестр кандидатов:
поиск/фильтры, аналитические карточки, таблица, создание и карточка кандидата
(редактирование, архивирование/восстановление).

Общий контекст — [`../../../../../CLAUDE.md`](../../../../../CLAUDE.md) и
[`docs/ARCHITECTURE.md`](../../../../../docs/ARCHITECTURE.md).

## Состав файлов

| Файл | Назначение |
|------|-----------|
| `CandidatesSection.tsx` | Оркестратор: состояние фильтров/модалки, данные из `usePortal`, вызов фильтрации и метрик, композиция |
| `CandidatesTable.tsx` | Таблица кандидатов: sticky-колонка ФИО, синхронный горизонтальный скролл, пагинация «Показать ещё» |
| `AddCandidateModal.tsx` | Модалка создания (ФИО, проект, город, рекрутер; остальное — в карточке) |
| `RealCandidateDrawer.tsx` | Карточка кандидата: редактирование всех полей, таймлайн, архив/восстановление |
| `candidateFilters.ts` | Чистая `filterCandidates(candidates, filters)` |
| `candidateMetrics.ts` | Чистая `calculateCandidateMetrics(candidates)` |
| `index.ts` | Реэкспорт `CandidatesSection`, `RealCandidateDrawer` |
| `CandidatesSection.module.css` | Стили раздела (таблица, тулбар, карточки) |

`CandidatesSection.module.css` используется только этим разделом. Карточки-
дровер используют `../CandidateDrawer.module.css` (общий со старым mock-дровером,
который остаётся в родительской папке `sections/`).

## Поток данных

```
CandidatesSection
  → usePortal(): realCandidates, addRealCandidate, openRealCandidateDrawer, …
  → filterCandidates(realCandidates, {search, project, stage, showArchived})
  → calculateCandidateMetrics(filtered)
  → <CandidatesTable rows=filtered.slice(…) onRowClick=openRealCandidateDrawer />
  → <AddCandidateModal onSubmit=addRealCandidate />
```

Компонент не обращается к Supabase напрямую — только через `usePortal()`.
CRUD выполняют репозитории (`lib/supabase/candidatesRepo.ts`), вызываемые из
`PortalContext`.

## Фильтры (`candidateFilters.ts`)

Чистая функция без React/Supabase. Отсекает по:

- **архиву** — при `showArchived = false` архивированные (`archived_at`) скрыты;
- **проекту** — точное совпадение (пусто = все проекты);
- **стадии** — точное совпадение (пусто = все стадии);
- **поиску** — подстрока по ФИО, телефону, telegram, max, external_id, городу.

## Метрики (`candidateMetrics.ts`)

Считаются **по результату `filterCandidates`** (текущая выборка), не по всем
данным. Правила:

- **«Ожидают выхода»** и **«Успешно вышли»** — взаимоисключающие.
- Кандидат **успешно вышел**, если заполнено `first_shift_at` **или** стадия
  входит в число успешных (`SUCCESSFUL_STAGES` из `lib/portal/candidateOptions`).
- **«Есть медкнижка»** считается **независимо** (`has_medical_book === true`).
- Процент = доля от размера выборки, округление к целому.
- При **пустой выборке** — `0` и `0%` (без `NaN`, без деления на ноль).

## Открытие drawer

Клик по строке таблицы → `openRealCandidateDrawer(id)` (из контекста) → в
`PortalContext` ставится `selectedRealCandidateId` → `RealCandidateDrawer`
(рендерится в `PortalApp`) находит кандидата и открывается. Закрытие —
`closeRealCandidateDrawer`.

## Добавление кандидата

`AddCandidateModal` собирает минимум (ФИО обязательно) и вызывает
`addRealCandidate` из контекста → `candidatesRepo.createCandidate` → вставка в
Supabase → список в контексте обновляется, показывается тост. Остальные поля
заполняются позже в карточке.

## Зависимости от `usePortal`

- `realCandidates`, `realCandidatesLoading`, `realCandidatesError`,
  `refreshRealCandidates` — данные и состояние загрузки.
- `addRealCandidate` — создание.
- `openRealCandidateDrawer` — открытие карточки.
- `saveRealCandidate`, `archiveRealCandidate`, `restoreRealCandidate` — в
  `RealCandidateDrawer`.
- `listOptions` — подсказки для города/рекрутера (Combobox).
- `pushToast`, `setContextAction` — служебное.

## Зависимости от Supabase

Косвенные, через контекст → репозитории:
`lib/supabase/candidatesRepo.ts`, типы `candidates.types.ts`. Прямых обращений
к Supabase из компонентов раздела нет.

## Бизнес-правила (сводка)

- Метрики — по отфильтрованной выборке.
- «Ожидают выхода» / «Успешно вышли» — взаимоисключающие.
- Успешно вышел = `first_shift_at` заполнено или успешная стадия.
- Медкнижка — независимый счётчик.
- Пустая выборка → `0` / `0%`, без `NaN`.
- Архив влияет на выборку через фильтр `showArchived`.
- Кандидаты не удаляются физически — только архивируются (`archived_at`).

## Безопасный порядок изменений

1. Найти затронутые файлы раздела и их использования (в т.ч. `PortalApp`,
   `index.ts`).
2. Прочитать оркестратор, чистую логику, типы и стили.
3. Логику фильтров/метрик менять в `.ts`-файлах, а не в JSX.
4. Не менять публичный API компонентов и `usePortal()` без необходимости.
5. После изменения — `npx tsc --noEmit`, затем `lint` и `build`.
6. Проверить в браузере (раздел за авторизацией).
