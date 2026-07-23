# Архитектура портала ВКР

Технический обзор портала «ВКР — Ваш кадровый ресурс». Быстрый постоянный
контекст — в [`../CLAUDE.md`](../CLAUDE.md).

## Назначение

Внутренний портал для управления потребностью в персонале, кандидатами,
описанием вакансий и связанными кадровыми процессами. Только для
авторизованных сотрудников; самостоятельной регистрации нет.

## Общая архитектура

- **Next.js 16 App Router** с серверными и клиентскими компонентами.
- Точка входа портала — роут `/` ([`src/app/page.tsx`](../src/app/page.tsx)):
  серверный компонент, получает текущего пользователя через серверный
  Supabase-клиент и рендерит `<PortalApp initialUserEmail=… />`.
- Портал — **SPA внутри одного роута**: разделы не имеют отдельных URL,
  переключаются клиентски по `activePage` из `PortalContext`.
- Стилизация: **CSS Modules** для компонентов портала + утилиты **Tailwind 4**
  в app-оболочке.

## Дерево основных папок

```
src/
  app/
    page.tsx                 # роут "/" — портал (server component)
    layout.tsx               # корневой layout, metadata, шрифты
    login/                   # /login
    forgot-password/         # /forgot-password
    update-password/         # /update-password
    icon.svg                 # favicon (Next.js convention)
  proxy.ts                   # middleware: защита роутов, обновление сессии
  components/portal/
    PortalApp.tsx            # провайдер + оболочка + переключение разделов
    context/PortalContext.tsx
    layout/                  # Sidebar, Topbar, MobileTabBar
    ui/                      # Button, Badge, Panel, StatCard, Modal, Drawer,
                             #   Combobox, Icon, PageHead, ToastStack, …
    sections/
      OverviewSection.tsx
      DemandSection.tsx
      VacanciesSection.tsx
      MarketingSection.tsx
      AnalyticsSection.tsx   (+ AnalyticsTabs.tsx)
      NotificationsSection.tsx
      SettingsSection.tsx
      CandidateDrawer.tsx    # mock-дровер (используется CommandPalette)
      candidates/            # раздел «Кандидаты» (real-данные)
  lib/
    portal/                  # constants, format, candidateOptions,
                             #   mock-генераторы, vacancyData (генерируемый)
    supabase/                # client, server, middleware, env, репозитории, типы
supabase/
  migrations/                # SQL-миграции (источник истины схемы)
```

(Опущены `node_modules`, `.next`, `public/`, `*.module.css` и крупные
генерируемые файлы.)

## Маршруты

| URL | Файл | Доступ |
|-----|------|--------|
| `/` | `app/page.tsx` | Только авторизованные (иначе редирект на `/login`) |
| `/login` | `app/login/page.tsx` | Публичный |
| `/forgot-password` | `app/forgot-password/page.tsx` | Публичный |
| `/update-password` | `app/update-password/page.tsx` | Публичный (recovery-сессия) |

Защиту и обновление сессии выполняет [`src/proxy.ts`](../src/proxy.ts)
(в Next.js 16 middleware-файл называется `proxy`).

## Layout

`PortalApp` → `PortalProvider` → `PortalShell`. Оболочка: `Sidebar` (навигация),
`Topbar` (профиль, поиск, командная палитра), `MobileTabBar` (мобильная
навигация), область контента с активным разделом, оба дровера
(`CandidateDrawer`, `RealCandidateDrawer`) и `ToastStack`.

## Контекст

[`PortalContext.tsx`](../src/components/portal/context/PortalContext.tsx) —
единый клиентский стор (React Context + `useState`/`useCallback`/`useMemo`).
Содержит три слоя данных:

1. **Mock-слой** (legacy): `candidates`, `addCandidate`, `addComment`,
   `selectedCandidateId` — питает `AnalyticsTabs`, `CommandPalette`, старый
   `CandidateDrawer`. Не рефакторится.
2. **Real-слой (Supabase):** `realCandidates` + CRUD (`addRealCandidate`,
   `saveRealCandidate`, `archiveRealCandidate`, `restoreRealCandidate`),
   `selectedRealCandidateId`.
3. **Справочники:** `listOptions` + операции (`addListOption`,
   `renameListOption`, `setListOptionActive`, `reorderListOption`).

Плюс кросс-раздельное: навигация (`activePage`), тосты, уведомления, `authEmail`,
`signOut`, плотность таблиц.

> **Тех-долг:** контекст крупный (~40 значений в одном `value`). При росте —
> вынос доменов в отдельные хуки (`useRealCandidates`, `useListOptions`),
> сохраняя публичный API `usePortal()`. Пока не требуется.

## UI-примитивы

Общие компоненты в `src/components/portal/ui/` переиспользуются всеми
разделами: `Button`, `Badge`, `Panel`, `StatCard`, `Modal`, `Drawer`,
`Dropdown`, `Combobox`, `Icon`, `PageHead`, `StateViews`, `ToastStack`,
`CommandPalette`, `BrandMark`. Не дублировать их внутри разделов.

## Разделы портала

Переключаются клиентски (`NAV_ITEMS` в `lib/portal/constants.ts`): Обзор,
Потребность, Кандидаты, Описание вакансий, Маркетинг, Аналитика, Уведомления,
Настройки. На реальные данные Supabase переведён только раздел **Кандидаты**
(и справочники в Настройках); остальные работают на mock-данных / статических
данных (`vacancyData`).

## Data-flow

```
UI (Section/*.tsx)
  → usePortal() (PortalContext)
    → repository (lib/supabase/*Repo.ts)
      → Supabase client (lib/supabase/client.ts | server.ts)
        → Postgres (RLS: authenticated-only)
```

Компоненты не обращаются к Supabase напрямую — только через контекст, который
вызывает репозитории. Репозитории возвращают типы из `*.types.ts`. Чистая
логика (фильтры/метрики) не знает ни про React, ни про Supabase.

## Структура раздела «Кандидаты»

Оркестратор `CandidatesSection` держит состояние фильтров и модалки, берёт
`realCandidates` из контекста, прогоняет через чистую `filterCandidates`, считает
`calculateCandidateMetrics`, и композитит `CandidatesTable` + `AddCandidateModal`.
Карточку рисует `RealCandidateDrawer`. Подробности —
[`../src/components/portal/sections/candidates/README.md`](../src/components/portal/sections/candidates/README.md).

## Mock и real-данные

- **Real (Supabase):** кандидаты и справочники списков.
- **Mock (`lib/portal/generate*.ts`, `constants.ts`):** данные для Обзора,
  Потребности, Маркетинга, Аналитики и legacy-слоя кандидатов в контексте.
- **Статические (`lib/portal/vacancyData.ts`):** описания вакансий,
  сгенерированы из Excel — файл не редактируется вручную.

Mock- и real-слои сосуществуют намеренно: перевод остальных разделов на
Supabase — отдельная будущая работа.

## Зоны технического долга

- Крупный `PortalContext` (см. выше).
- Разделы `Demand`/`Settings` монолитны (по 3 компонента в файле) — можно
  разбить по образцу раздела кандидатов при необходимости.
- Часть разделов ещё на mock-данных.
- Auth-страницы дублируют брендблок (кандидат на общий `AuthShell`).

Тех-долг фиксируется, но не исправляется «заодно» — только по отдельной задаче.

## Как добавить новый раздел

1. Создать папку `sections/<name>/` с оркестратором `<Name>Section.tsx`.
2. Подкомпоненты (таблицы, модалки, drawer) — отдельными файлами в той же папке.
3. Чистую логику — в `.ts`-файлы без React/Supabase.
4. Данные — через `PortalContext` (не обращаться к Supabase из компонента).
5. Зарегистрировать пункт в `NAV_ITEMS` (`lib/portal/constants.ts`) и ветку в
   `ActiveSection` (`PortalApp.tsx`).
6. Переиспользовать примитивы из `ui/`, не дублировать их.
