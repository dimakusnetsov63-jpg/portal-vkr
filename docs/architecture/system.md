# Архитектура портала ВКР

Технический обзор портала «ВКР — Ваш кадровый ресурс». Быстрый постоянный
контекст — в [`../CLAUDE.md`](../../CLAUDE.md).

## Назначение

Внутренний портал для управления потребностью в персонале, кандидатами,
описанием вакансий и связанными кадровыми процессами. Только для
авторизованных сотрудников; самостоятельной регистрации нет.

## Общая архитектура

- **Next.js 16 App Router** с серверными и клиентскими компонентами.
- Точка входа портала — роут `/` ([`src/app/page.tsx`](../../src/app/page.tsx)):
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
    login/                   # /login — вход по логину и паролю
    403/                     # /403 — раздел закрыт для роли
    api/auth/                # login | logout | token (единственные API-роуты)
    icon.svg                 # favicon (Next.js convention)
  proxy.ts                   # middleware: сессия, активность, права на раздел
  components/portal/
    PortalApp.tsx            # провайдер + оболочка + переключение разделов
    context/PortalContext.tsx
    layout/                  # Sidebar, Topbar, MobileTabBar
    ui/                      # Button, Badge, Panel, StatCard, Modal, Drawer,
                             #   Combobox, Icon, PageHead, ToastStack, …
    sections/
      OverviewSection.tsx
      VacanciesSection.tsx
      MarketingSection.tsx   # заглушка «в разработке»
      AnalyticsSection.tsx   # заглушка «в разработке»
      NotificationsSection.tsx  # заглушка «в разработке»
      candidates/            # раздел «Кандидаты» (real-данные)
      demand/                # раздел «Потребность» (real-данные)
      addresses/             # раздел «Адреса» (real-данные)
      rates/                 # раздел «Ставки» (real-данные)
      settings/              # раздел «Настройки» (команда, роли, журнал)
  lib/
    auth/                    # roles (матрица прав), session, jwt, middleware
    portal/                  # constants (навигация), format, candidateOptions,
                             #   demandWindow, types, vacancyData (генерируемый)
    supabase/                # client, accessToken, env, репозитории, типы
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
| `/403` | `app/403/page.tsx` | Авторизованные: раздел закрыт для роли |
| `/api/auth/login` | route handler | Публичный (сам проверяет логин и пароль) |
| `/api/auth/logout` | route handler | Публичный (без сессии просто чистит cookie) |
| `/api/auth/token` | route handler | Только с действующей сессией |

Проверку сессии, активности пользователя и права на раздел выполняет
[`src/proxy.ts`](../../src/proxy.ts) → `lib/auth/middleware.ts` (в Next.js 16
middleware-файл называется `proxy`). Модель доступа —
[`../requirements/access-control.md`](../requirements/access-control.md).

## Layout

`PortalApp` → `PortalProvider` → `PortalShell`. Оболочка: `Sidebar` (навигация),
`Topbar` (профиль, поиск, командная палитра), `MobileTabBar` (мобильная
навигация), область контента с активным разделом, все четыре дровера
(`CandidateDrawer`, `RealCandidateDrawer`, `AddressDrawer`, `RateDrawer`) и
`ToastStack`.

## Контекст

[`PortalContext.tsx`](../../src/components/portal/context/PortalContext.tsx) —
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
4. **Потребность (Supabase):** `demandRows` + `demandWindow` (окно дат по
   умолчанию — сегодня −14/+45 дней) + CRUD (`upsertDemandCell`,
   `deleteDemandCell`, `addDemandBulk`, `bulkSetDemandCells`),
   `refreshDemand`. Отдельно — метаданные строки проект+город:
   `demandRowMeta` + `updateDemandRowMeta`, `refreshDemandRowMeta`
   (статус/комментарий, не привязаны к дате).
5. **Адреса (Supabase):** `addresses` + CRUD (`addAddress`, `saveAddress`,
   `archiveAddressRecord`, `restoreAddressRecord`, `duplicateAddressRecord`),
   `refreshAddresses`, `selectedAddressId` + `openAddressDrawer`/
   `closeAddressDrawer`. Один объект = одна карточка (в отличие от
   «Потребности», без матрицы по датам); дефицит и укомплектованность не
   хранятся — считаются в `addressMetrics.ts`.
6. **Ставки (Supabase):** `rateCards` + `rates` + CRUD (`addRate`,
   `saveRate`, `deleteRateRecord`, `saveRateCard`, `deleteRateCardRecord`),
   `refreshRates`, `selectedRateId` + `openRateDrawer`/`closeRateDrawer`.
   Два уровня: блок условий (`rate_cards`, «проект+город+юр. лицо») и
   строка тарифа (`rates`, должность внутри блока, FK с каскадом);
   join — в `rateMetrics.ts`, доход за смену/неделю/месяц не хранится.

Плюс кросс-раздельное: навигация (`activePage`), тосты, уведомления,
`currentUser`, `can(permission)`, `signOut`, плотность таблиц.

Списка пользователей в контексте **нет**: он нужен одной панели и только
руководителю, поэтому грузится в `TeamPanel` напрямую — тот же случай, что и
история в `DemandHistoryDrawer`.

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
Потребность, Адреса, Кандидаты, Описание вакансий, Ставки, Маркетинг,
Аналитика, Уведомления, Настройки. На реальные данные Supabase переведены
разделы **Кандидаты**, **Потребность**, **Адреса** и **Ставки** (и
справочники в Настройках); остальные работают на mock-данных / статических
данных (`vacancyData`). «Адреса» и «Ставки» — единственные разделы,
доступные всем четырём ролям, вместе с «Уведомлениями» (см.
[`../requirements/access-control.md`](../requirements/access-control.md)).

## Data-flow

```
UI (Section/*.tsx)
  → usePortal() (PortalContext)
    → repository (lib/supabase/*Repo.ts)
      → Supabase client (lib/supabase/client.ts)
        → JWT портала (/api/auth/token, 15 мин, кэш в accessToken.ts)
          → Postgres (RLS: portal_can('<раздел>'))
```

Компоненты не обращаются к Supabase напрямую — только через контекст, который
вызывает репозитории. Репозитории возвращают типы из `*.types.ts`. Чистая
логика (фильтры/метрики) не знает ни про React, ни про Supabase.

## Структура раздела «Кандидаты»

Оркестратор `CandidatesSection` держит состояние фильтров и модалки, берёт
`realCandidates` из контекста, прогоняет через чистую `filterCandidates`, считает
`calculateCandidateMetrics`, и композитит `CandidatesTable` + `AddCandidateModal`.
Карточку рисует `RealCandidateDrawer`. Подробности —
[`../src/components/portal/sections/candidates/README.md`](../../src/components/portal/sections/candidates/README.md).

## Структура раздела «Потребность»

Оркестратор `DemandSection` берёт `demandRows`/`demandWindow` из контекста,
прогоняет через чистые `filterDemandRows` → `listVisibleProjectCities` →
`buildDemandMatrix` (`demand/demandAggregate.ts`), считает итоги
(`demand/demandMetrics.ts`), и композитит `DemandToolbar` + `DemandMatrix`
(→ `DemandProjectRow` → `DemandCityRow` → `DemandCell`) + `AddDemandModal`.
Показываются только пары проект+город, по которым уже есть запись за
видимый период (без полного перекрёстного произведения) — только режим
«День» реализован, Неделя/Месяц не подключены. Проекты — из
`candidate_list_options` (`type = project`, тот же источник, что у
кандидатов/адресов/ставок), города — из `candidate_list_options` (`type =
city`). Каждая строка город+проект
дополнительно несёт статус и комментарий (`staffing_demand_rows`,
`DemandRowStatusBadge`/`DemandRowCommentButton` в `DemandCityRow`) — не
привязаны к дате, не копируются вместе со значениями потребности.
Редактирование ячейки — upsert/delete
по (`project`, `city`, `demand_date`) через `staffingDemandRepo.ts`.

## Структура раздела «Адреса»

Оркестратор `AddressesSection` берёт `addresses` из контекста, прогоняет через
чистую `filterAddresses` (поиск сразу по нескольким полям — адрес/метро/
район/город/координатор/руководитель объекта), считает
`calculateAddressMetrics` (два входа — полный список для «Всего/Активных/
Архивных» и отфильтрованный без архива для остальных KPI, архив никогда не
участвует в KPI), и композитит `AddressesDashboard` + `AddressesTable` +
`AddAddressModal`. Карточку рисует `AddressDrawer`. Один адрес = одна
карточка (в отличие от «Потребности» — без матрицы по датам); архив — не
отдельная страница, а сегментированный переключатель поверх той же таблицы.
Проект/город/специализация — общие справочники с «Потребностью»/
«Кандидатами» (`candidate_list_options`). Подробности —
[`../../src/components/portal/sections/addresses/README.md`](../../src/components/portal/sections/addresses/README.md).

## Структура раздела «Ставки»

Оркестратор `RatesSection` берёт `rates`/`rateCards` из контекста, сводит их
в `RateWithCard[]` через `joinRatesWithCards` (`rateMetrics.ts`) — join на
клиенте, без дополнительных запросов, — прогоняет через чистую `filterRates`
(поиск сразу по нескольким полям: должность/проект/город/юр. лицо/
комментарий), считает `calculateRateMetrics`, и композитит `RatesDashboard` +
`RatesTable` + `AddRateModal`. Карточку рисует `RateDrawer` — одна карточка
показывает и строку тарифа, и условия её блока (`rate_cards`) с явным
предупреждением о числе ставок, которые их разделяют. Два уровня хранения,
не один: блок условий («проект+город+юр. лицо») отдельно от строки тарифа
(должность внутри блока), связаны настоящим FK с каскадом — в отличие от
`staffing_demand_rows`, которая связана с `staffing_demand` естественным
ключом без FK. Доход за смену/неделю/месяц не хранится — считается в
`rateMetrics.ts` из ставок и графика. Удаление — настоящее (`DELETE`), не
soft-delete, как у `staffing_demand`. Подробности —
[`../../src/components/portal/sections/rates/README.md`](../../src/components/portal/sections/rates/README.md).

## Источники данных

- **Real (Supabase):** кандидаты, справочники списков, потребность, адреса,
  ставки, пользователи и журнал действий.
- **Статические (`lib/portal/vacancyData.ts`):** описания вакансий,
  сгенерированы из Excel — файл не редактируется вручную. Данные настоящие,
  просто не редактируются в портале.
- **Никаких.** Обзор, Маркетинг, Аналитика и Уведомления показывают заглушку
  `ui/SectionUnderDevelopment.tsx`.

**Mock-слоя в портале больше нет.** До C-7 существовали генераторы
`generateCandidates.ts`, `generateDemand.ts`, `random.ts` и `notifications.ts`,
а также словари `PROJECTS`/`RECRUITERS`/`CHANNELS` в `constants.ts` — все
удалены. Правило на будущее: раздел либо работает на реальных данных, либо
честно сообщает, что не готов. Промежуточного состояния «выглядит рабочим,
не будучи им» быть не должно.

## Зоны технического долга

- Крупный `PortalContext` (см. выше).
- Четыре раздела не реализованы и показывают заглушку (Обзор, Маркетинг,
  Аналитика, Уведомления). В «Настройках» осталась панель «Отображение»:
  переключатель плотности работает, но выбор не переживает перезагрузку.
- `/login` и `/403` дублируют брендблок (кандидат на общий `AuthShell`).
- Матрица прав продублирована в SQL и TS (см. `lib/auth/roles.ts`).
- Режимы «Неделя»/«Месяц» в «Потребности» не реализованы (осознанно
  отложены на следующий этап, см. `demand/demandAggregate.ts`).

Тех-долг фиксируется, но не исправляется «заодно» — только по отдельной задаче.

## Как добавить новый раздел

1. Создать папку `sections/<name>/` с оркестратором `<Name>Section.tsx`.
2. Подкомпоненты (таблицы, модалки, drawer) — отдельными файлами в той же папке.
3. Чистую логику — в `.ts`-файлы без React/Supabase.
4. Данные — через `PortalContext` (не обращаться к Supabase из компонента).
5. Зарегистрировать пункт в `NAV_ITEMS` (`lib/portal/constants.ts`) и ветку в
   `ActiveSection` (`PortalApp.tsx`).
6. Добавить раздел в `PortalPage` (`lib/portal/types.ts`) и **в обе матрицы
   прав**: `SECTION_ORDER`/`ROLE_PERMISSIONS` в `lib/auth/roles.ts` и
   `portal_role_sections()` в SQL — иначе раздел не увидит никто.
7. Переиспользовать примитивы из `ui/`, не дублировать их.
