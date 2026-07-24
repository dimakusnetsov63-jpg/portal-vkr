# Раздел «Потребность»

Редактируемая матрица потребности в персонале: проекты → города (строки) ×
даты (колонки). Реальные данные Supabase (`public.staffing_demand` —
числа по датам; `public.staffing_demand_rows` — статус и комментарий на
уровень строки проект+город, не привязанные к дате). Только режим «День»
— Неделя/Месяц не реализованы в этой версии.

Общий контекст — [`../../../../../CLAUDE.md`](../../../../../CLAUDE.md) и
[`docs/ARCHITECTURE.md`](../../../../../docs/ARCHITECTURE.md).

## Состав файлов

| Файл | Назначение |
|------|-----------|
| `DemandSection.tsx` | Оркестратор: фильтры, состояние сворачивания, данные из `usePortal`, композиция |
| `DemandToolbar.tsx` | Поиск, фильтры проект/город, «Сбросить», кнопка «Добавить потребность» |
| `DemandMatrix.tsx` | Таблица: sticky-колонка слева, sticky-колонка «Итого» справа, sticky-заголовок дат, sticky-итоговая строка снизу, синхронный горизонтальный скролл |
| `DemandProjectRow.tsx` | Строка проекта: сворачивание, цветной маркер (`avatarColor`), итог по проекту |
| `DemandCityRow.tsx` | Строка города: ячейки по датам, итог по городу |
| `DemandCell.tsx` | Одна ячейка: просмотр / инлайн-редактирование / индикатор сохранения / откат при ошибке |
| `AddDemandModal.tsx` | Модалка: проект, несколько городов, период, количество, счётчик «будет создано/обновлено N» |
| `demandAggregate.ts` | Чистая: группировка Supabase-строк в матрицу, список видимых пар проект+город, колонки по дням, цветовой уровень ячейки, валидация |
| `demandFilters.ts` | Чистая `filterDemandRows(rows, {search, project, city})` |
| `demandMetrics.ts` | Чистая: итог по городу/проекту/колонке/периоду |
| `demandCellEdit.ts` | Чистая `resolveCellCommit` — что делать с draft-вводом ячейки |
| `demandCopy.ts` | Чистая: цели копирования (день/7 дней/до даты/неделя), `repeatWeekRows` |
| `demandQueryParams.ts` | Чистая сериализация/чтение URL-состояния раздела |
| `demandRowMeta.ts` | Чистая: статус/комментарий строки (project+city) — `DemandRowStatus`, `getRowMeta`, `mergeRowMetaPatch`, `filterGroupsByRowStatus`, `demandRowMetaKey` |
| `DemandCellMenu.tsx` | Меню «⋯» на заполненной ячейке: копирование |
| `DemandRowStatusBadge.tsx` | Badge статуса строки + дропдаун смены статуса |
| `DemandRowCommentButton.tsx` | Иконка-индикатор комментария + модалка редактирования |
| `index.ts` | Реэкспорт `DemandSection` |
| `DemandSection.module.css` | Стили раздела |

## Поток данных

```
DemandSection
  → usePortal(): demandRows, demandWindow, refreshDemand,
                  upsertDemandCell, deleteDemandCell, addDemandBulk, listOptions
  → filterDemandRows(demandRows, {search, project, city})
  → listVisibleProjectCities(filtered)   — только пары с хотя бы одной записью
  → buildDemandMatrix(filtered)
  → getDayColumns(demandWindow.from, demandWindow.to)
  → <DemandMatrix> (→ DemandProjectRow → DemandCityRow → DemandCell)
  → <AddDemandModal onSubmit=addDemandBulk>
```

Компонент не обращается к Supabase напрямую — только через `usePortal()`.
CRUD выполняет `lib/supabase/staffingDemandRepo.ts`, вызываемый из
`PortalContext`.

## Бизнес-правила (сводка)

- Строка проект+город показывается, только если по ней есть хотя бы одна
  запись за видимый период — новую пару можно завести только через
  «Добавить потребность» (простое редактирование пустой матрицы новую
  строку не создаёт).
- Пустая ячейка = потребность не выставлена (нет строки в БД), `0` — валидное
  явное значение «потребность отсутствует».
- Редактирование ячейки: `Enter`/клик вне — сохраняет, `Escape` — отменяет.
  Новое число ≥ 0 → upsert; очистка существующего значения → физическое
  удаление строки (см. `docs/DATABASE.md` про отказ от soft-delete именно для
  этой таблицы).
- Итоги считаются по текущей отфильтрованной выборке (после
  `filterDemandRows`), не по всем данным — так же, как в разделе
  «Кандидаты».
- Видимое окно дат по умолчанию — сегодня −14/+45 дней
  (`lib/portal/demandWindow.ts`), от реальной текущей даты.
- Массовое добавление — декартово произведение выбранных городов × дат
  периода с одним и тем же значением; модалка показывает итоговое число
  записей до сохранения.
- **Статус и комментарий строки** (`staffing_demand_rows`) — на пару
  project+city, не на дату. Запись создаётся только при первом изменении
  (upsert по `unique(project, city)`); её отсутствие в UI = `active` +
  пустой комментарий (`getRowMeta`). Копирование значений (меню «⋯»,
  «Повторить строку на следующую неделю», массовое добавление) трогает
  только `staffing_demand` — статус/комментарий никогда не копируются и
  остаются привязаны к исходной паре project+city.
  Обновление одного поля (`status` или `comment`) не затирает другое —
  `mergeRowMetaPatch` объединяет частичный patch с текущими/дефолтными
  значениями перед upsert.
- Фильтр «Статус строки» (`rowStatus` в URL, whitelist `active/paused/
  closed`) применяется к строкам город+проект **после** фильтра «Только
  заполненные» — обе фильтрации работают на уровне строки, не ячейки.

## Безопасный порядок изменений

1. Найти затронутые файлы раздела и их использования (`PortalApp`, `index.ts`).
2. Прочитать оркестратор, чистую логику (`demandAggregate.ts`/`demandFilters.ts`/
   `demandMetrics.ts`), типы и стили.
3. Логику агрегации/фильтров/итогов менять в `.ts`-файлах, а не в JSX.
4. Не менять публичный API компонентов и `usePortal()` без необходимости.
5. После изменения — `npx tsc --noEmit`, `npm run test`, затем `lint` и `build`.
6. Проверить в браузере (раздел за авторизацией).
