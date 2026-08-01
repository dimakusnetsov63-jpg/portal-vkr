# CLAUDE.md

Постоянный контекст для Claude Code при работе с этим репозиторием. Держите
документ компактным; подробности — в [`docs/`](docs/).

## 0. Правила работы с документацией

Перед реализацией любой задачи:

1. Прочитать [`docs/README.md`](docs/README.md) — карта документации.
2. Проверить [`docs/tasks/current.md`](docs/tasks/current.md) — что уже в работе.
3. Прочитать требования затронутого раздела — [`docs/requirements/`](docs/requirements/).
4. Если задача трогает данные — [`docs/database/schema.md`](docs/database/schema.md)
   и [`docs/database/migrations.md`](docs/database/migrations.md).

После завершения задачи:

5. Обновить документацию **в том же коммите**, что и код.
6. Перенести задачу в [`docs/tasks/completed.md`](docs/tasks/completed.md).

Что именно обновлять:

| Что изменилось | Что править |
|---|---|
| Бизнес-правило | `docs/requirements/*.md` |
| Схема БД | `docs/database/schema.md`, `migrations.md` |
| Политики доступа | `docs/database/policies.md` |
| Архитектура | `docs/architecture/*.md` |
| Значимое техническое решение | новый ADR в `docs/architecture/decisions/` |
| Внутреннее устройство раздела | `src/components/portal/sections/*/README.md` |
| Заметное для пользователя изменение | `docs/changelog/CHANGELOG.md` |

Крупная задача оформляется отдельным файлом по шаблону
[`docs/tasks/TEMPLATE.md`](docs/tasks/TEMPLATE.md).

Не создавать пустые файлы-заглушки и не описывать только то, что работает:
известные ограничения проговариваются явно.

## 1. Назначение проекта

**«ВКР — Ваш кадровый ресурс»** — внутренний портал для управления
потребностью в персонале, кандидатами, описанием вакансий и связанными
кадровыми процессами. Доступ только для сотрудников: учётные записи создаёт
руководитель в разделе «Настройки → Команда и роли», самостоятельной
регистрации нет. Проект развивается по модульному принципу: каждый крупный
раздел живёт в своей доменной папке.

## 2. Технологический стек

Только реально используемое (версии — в [`package.json`](package.json)):

- **Next.js 16** (App Router, Turbopack) + **React 19**
- **TypeScript**
- **Supabase** (`@supabase/supabase-js`) — БД и API. Auth **не используется**:
  авторизация своя, см. §7.1
- **CSS Modules** — стилизация компонентов портала (`*.module.css`)
- **Tailwind CSS 4** — только утилиты в app-оболочке (`layout.tsx`,
  `globals.css`); компоненты портала на CSS Modules, не на Tailwind
- **Vercel** — хостинг, автодеплой при пуше в `main`
- **ESLint** (`eslint-config-next`)

## 3. Главные правила работы

1. Не менять дизайн без прямой команды.
2. Не менять функциональность за пределами текущей задачи.
3. Не делать побочных «улучшений заодно».
4. Не менять Supabase-схему и названия полей без отдельного согласования и
   миграции.
5. Никогда не использовать `service_role` / секретные ключи в клиентском коде.
   В коде используется только publishable-ключ + RLS.
6. Переиспользовать общие UI-компоненты и классы из
   `src/components/portal/ui/` (`Button`, `primitives.table`,
   `primitives.btnIcon`, `primitives.checkLabel`, `StateViews`).
7. Не дублировать существующие компоненты и бизнес-логику.
7.1. Любое число в стилях — из токенов `src/app/portal-tokens.css`
   (цвет, отступ, радиус, тень, длительность, кегль, высота контрола).
   Литерал в `*.module.css` и инлайновый `style={{ fontSize }}` — ошибка
   ревью. Шкалы и исключения — [`docs/architecture/frontend.md`](docs/architecture/frontend.md).
8. Код раздела хранить внутри его доменной папки.
9. Чистую бизнес-логику (фильтры, метрики, преобразования) отделять от JSX —
   в отдельные `.ts`-файлы.
10. Не редактировать генерируемые файлы вручную (см. §7).
11. Перед удалением файла проверять все его использования (grep по проекту).
12. Не выполнять `push`, deploy, миграции и destructive-команды без прямой
    команды пользователя.

## 4. Карта архитектуры

| Путь | Назначение |
|------|-----------|
| `src/app/` | Роуты App Router: `/` (портал), `/login`, `/403`, `api/auth/*`, `layout.tsx`, `icon.svg` |
| `src/proxy.ts` | Middleware (Next.js 16 переименовал `middleware`→`proxy`): сессия, активность пользователя, права на раздел |
| `src/components/portal/PortalApp.tsx` | Корень портала: провайдер + оболочка + переключение разделов по `activePage` |
| `src/components/portal/context/` | `PortalContext.tsx` — единый клиентский стор (кандидаты, потребность, адреса, ставки, справочники, `currentUser`/`can`) |
| `src/components/portal/layout/` | `Sidebar`, `Topbar`, `MobileTabBar` |
| `src/components/portal/ui/` | Общие примитивы: `Button`, `Badge`, `Panel`, `StatCard`, `Modal`, `Drawer`, `Combobox`, `Icon`, `PageHead`, `ToastStack`, … |
| `src/components/portal/sections/` | Разделы портала (обзор, потребность, кандидаты, вакансии, маркетинг, аналитика, уведомления, настройки) |
| `src/lib/auth/` | Авторизация: `roles` (матрица прав), `session`, `serverSession`, `jwt`, `middleware`, `env` |
| `src/lib/portal/` | Клиентские данные/утилиты: `constants` (навигация), `format`, `candidateOptions`, `demandWindow`, `types`, `vacancyData` (генерируемый) |
| `src/lib/supabase/` | Data-слой: `client`, `accessToken`, `env`, репозитории, типы |
| `supabase/migrations/` | SQL-миграции (источник истины для схемы БД) |

Разделы портала — **не** отдельные URL-роуты. Портал это SPA на `/`;
переключение разделов — клиентское, через `activePage` в `PortalContext`.

## 5. Правила модульной структуры

- Каждый крупный раздел — собственная папка внутри `sections/`.
- Основной `*Section.tsx` остаётся **оркестратором** (состояние, данные из
  контекста, композиция).
- Таблицы, drawer, модалки и крупные подкомпоненты выносятся в отдельные файлы.
- Фильтры, метрики и преобразования данных — в чистые `.ts`-файлы (без React,
  JSX и запросов к Supabase).
- Не создавать отдельные файлы по 10–20 строк без пользы.
- Разделять по **ответственности**, а не только ради уменьшения числа строк.

## 6. Раздел «Кандидаты»

Единственный раздел, переведённый на реальные данные Supabase.
Структура — `src/components/portal/sections/candidates/`:

| Файл | Назначение |
|------|-----------|
| `CandidatesSection.tsx` | Оркестратор: фильтры, данные из `usePortal`, композиция |
| `CandidatesTable.tsx` | Таблица кандидатов (sticky-колонка, пагинация) |
| `AddCandidateModal.tsx` | Модалка создания кандидата |
| `RealCandidateDrawer.tsx` | Карточка кандидата (редактирование, архив/восстановление) |
| `candidateFilters.ts` | Чистая `filterCandidates(candidates, filters)` |
| `candidateMetrics.ts` | Чистая `calculateCandidateMetrics(candidates)` |
| `index.ts` | Реэкспорт `CandidatesSection`, `RealCandidateDrawer` |
| `CandidatesSection.module.css` | Стили раздела |

Бизнес-правила метрик (детали — [`candidates/README.md`](src/components/portal/sections/candidates/README.md)):

- Метрики считаются по **текущей отфильтрованной** выборке, не по всем данным.
- «Ожидают выхода» и «Успешно вышли» — взаимоисключающие.
- Успешно вышедший = есть `first_shift_at` **или** стадия из числа успешных.
- Наличие медкнижки считается **независимо**.
- При пустой выборке процент = `0` (никогда `NaN`, без деления на ноль).
- Архив влияет на выборку через существующий фильтр `showArchived`.

Mock-дровера `sections/CandidateDrawer.tsx` больше нет — удалён в C-7 вместе
с генераторами выдуманных данных. `CommandPalette` (⌘K) ищет по реальному
реестру и открывает `RealCandidateDrawer`.

Разделы «Обзор», «Аналитика», «Маркетинг» и «Уведомления» показывают
заглушку `ui/SectionUnderDevelopment.tsx`: их прежнее содержимое было
выдуманным. Разделы остались в меню и в матрице прав — заглушка честно
сообщает, что появится и от чего это зависит. **Никаких чисел, процентов,
дат и прогнозов в заглушке быть не должно.**

## 6.1. Раздел «Адреса»

`src/components/portal/sections/addresses/`: `AddressesSection.tsx`
(оркестратор — сегментированный переключатель «Активные/Архив», фильтры,
поиск), `AddressesDashboard.tsx` (8 KPI), `AddressesTable.tsx`,
`AddAddressModal.tsx`, `AddressDrawer.tsx` (карточка), `addressFilters.ts`,
`addressMetrics.ts` (чистые, с тестами), `addressOptions.ts`. Детали —
[`addresses/README.md`](src/components/portal/sections/addresses/README.md),
бизнес-правила — [`docs/requirements/addresses.md`](docs/requirements/addresses.md).

Один адрес = одна карточка (в отличие от «Потребности» — без матрицы по
датам). Раздел доступен **всем четырём ролям** — вместе с «Уведомлениями»
единственный такой случай. Специализация (`position`) — тот же справочник
`candidate_list_options`, что у «Потребности»/«Кандидатов», не отдельный.
Дефицит и укомплектованность **не хранятся в БД** — считаются на клиенте;
при отсутствии потребности укомплектованность явно `100%`. Документы —
только внешние ссылки (в проекте нет Supabase Storage). Полной построчной
истории изменений пока нет — только снимок «кто/когда создал/изменил» в
самой строке (`created_by`/`updated_by`); полноценный аудит — следующая
задача.

## 6.2. Раздел «Ставки»

`src/components/portal/sections/rates/`: `RatesSection.tsx` (оркестратор —
фильтры, поиск, данные из контекста), `RatesDashboard.tsx` (8 KPI),
`RatesTable.tsx`, `AddRateModal.tsx`, `RateDrawer.tsx` (карточка ставки и
условий её блока), `rateFilters.ts`, `rateMetrics.ts` (join + вычисляемые
доход за смену/неделю/месяц, чистые, с тестами), `rateOptions.ts`. Детали —
[`rates/README.md`](src/components/portal/sections/rates/README.md),
бизнес-правила — [`docs/requirements/rates.md`](docs/requirements/rates.md).

Два уровня хранения: `public.rate_cards` — блок условий «проект + город +
юр. лицо» (зарплатный проект, бонусы, акции, надбавки, менеджер, работа
офиса), общий для всех тарифов блока; `public.rates` — строка тарифа по
должности внутри блока, связана с ним настоящим FK с каскадом
(`rate_card_id ... on delete cascade`). Раздел доступен всем четырём ролям,
как «Адреса». Доход за смену/неделю/месяц **не хранится** — считается на
клиенте из ставок и графика. Удаление — настоящее (`DELETE`), не архив: у
устаревшего тарифа нет исторической ценности. Список проектов раздела —
`candidate_list_options` (`list_type = project`), общий для всего портала
(см. `docs/database/migrations.md`, миграция `20260731120000`).

## 6.3. Раздел «Настройки»

`src/components/portal/sections/settings/`: `SettingsSection.tsx`
(оркестратор), `TeamPanel.tsx` (команда и роли), `UserFormModal.tsx`,
`AuditLogPanel.tsx`, `CandidateListsPanel.tsx`, `userForm.ts` (чистая
валидация + тесты). Детали — [`settings/README.md`](src/components/portal/sections/settings/README.md).

Панели «Команда и роли» и «Журнал действий» видит только роль
«Руководитель». Список пользователей грузится в `TeamPanel`, а не в
`PortalContext` — он нужен одной панели и одной роли.

## 7. Supabase

- **Клиенты:** `src/lib/supabase/client.ts` — `createClient()` (данные) и
  `createPortalAuthClient()` (RPC управления пользователями). Оба используют
  только publishable-ключ; `service_role` в коде не используется.
- **Репозитории:** `candidatesRepo.ts`, `candidateListOptionsRepo.ts`,
  `staffingDemand*Repo.ts`, `portalUsersRepo.ts`, `addressesRepo.ts`,
  `ratesRepo.ts` — вся работа с БД, возвращают типы.
- **Типы:** `candidates.types.ts`, `candidateListOptions.types.ts`,
  `addresses.types.ts`, `rates.types.ts` и др. выведены из
  `database.types.ts` (у `addresses` поле `document_links`, у `rates` поле
  `extras` переопределены поверх сгенерированного `Json`, см. комментарий в
  файле). Исключение — `portalAuth.types.ts`: описывает не таблицы (закрыты
  RLS полностью), а типизированный RPC-клиент, поэтому написан руками
  отдельно от `Database`.
- **Миграции:** `supabase/migrations/*.sql` — источник истины для схемы.
- **Env (в `.env.local`, НЕ коммитить):** `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_JWT_SECRET` (серверная,
  без `NEXT_PUBLIC_`). Реальные значения в документацию не записывать.

### 7.1 Авторизация

Supabase Auth не используется — портал ведёт пользователей сам
([ADR-004](docs/architecture/decisions/ADR-004-portal-auth.md),
[requirements/access-control.md](docs/requirements/access-control.md)).

- Пользователи, сессии и журнал — `portal_users`, `portal_sessions`,
  `portal_audit_log`. Таблицы закрыты RLS полностью, доступ только через
  `SECURITY DEFINER` функции `portal_*`.
- Пароли — bcrypt в базе. **Никогда** не возвращать их клиенту, не писать в
  логи и не показывать в интерфейсе; действующий пароль недоступен даже
  администратору.
- Сессия — httpOnly-cookie; токен доступа к PostgREST портал подписывает сам
  (`src/lib/auth/jwt.ts`) и обновляет через `/api/auth/token`.
- **Матрица прав живёт в двух местах** — `src/lib/auth/roles.ts` и
  `public.portal_role_sections()` в SQL. Меняется всегда в обоих:
  рассинхронизацию не поймают ни типы, ни тесты.
- Новый раздел портала нужно добавить в `PortalPage`, `NAV_ITEMS`,
  `ActiveSection` **и в обе матрицы прав**.
- **Генерируемые файлы (не редактировать вручную):**
  `src/lib/supabase/database.types.ts` (`supabase gen types typescript`),
  `src/lib/portal/vacancyData.ts` (из Excel «Описание вакансий»),
  `next-env.d.ts`.
- Изменение схемы = новая миграция **+** регенерация `database.types.ts`.

## 8. Порядок работы над задачей

1. Найти связанные файлы (grep/glob по проекту).
2. Прочитать основной компонент, типы, data-слой и стили.
3. Найти все использования изменяемого компонента.
4. Кратко описать план.
5. Внести минимальные изменения.
6. После логического этапа — `npx tsc --noEmit`.
7. В конце — `npm run lint` и `npm run build`.
8. Сообщить изменённые файлы, результаты проверок и непроверенные части.

## 9. Проверки

```
npx tsc --noEmit   # проверка типов (отдельного npm-скрипта нет)
npm run lint       # ESLint
npm run build      # production-сборка (next build)
npm run dev        # dev-сервер (next dev)
```

- `tsc` проверяет только типы.
- `lint` не заменяет функциональную проверку.
- `build` не гарантирует корректность интерфейса.
- Изменения UI нужно проверять в браузере (раздел кандидатов — за авторизацией).

## 10. Git-правила

- Одна логическая задача — один коммит.
- Не смешивать рефакторинг, брендинг и функциональные изменения в одном коммите.
- Перед коммитом: `git diff --check` и `git status --short`.
- Не коммитить секреты и `.env.local` (покрыто `.gitignore` через `.env*`).
- Не пушить без прямой команды пользователя.
- Понятные сообщения коммитов (тип + область, напр. `refactor(candidates): …`).
