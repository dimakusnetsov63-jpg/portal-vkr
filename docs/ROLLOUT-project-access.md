# Выкат разграничения доступа по проектам (H-6)

Пошаговая инструкция фаз A→B→C→D. Контекст, обоснование и принятые решения —
`AUDIT-2026-07-31.md` (находка H-6). Код — ветка/коммиты см. `tasks/completed.md`.

## Принятые решения (не пересматриваются в рамках этого выката)

1. **`head` — bypass.** Роль `head` видит все проекты независимо от
   содержимого своего `portal_users.projects` — поле для неё остаётся
   информационным, как и сегодня.
2. **PII-колонки — вне рамок.** `phone`/`telegram_tag`/`salary_card` не
   ограничиваются этим выкатом — отдельная задача column-level protection.
3. **Тестирование — минимум.** Ручная проверка SQL/`curl` под разными
   ролями. H-13 (автотесты RLS) — следующий приоритет после закрытия H-6.
4. **UI-фильтры** сужаются до `currentUser.projects` для всех ролей кроме
   `head`.

---

## Фаза A — аддитивные функции

**Файл:** `supabase/migrations/20260803130000_project_access_functions.sql`.

Создаёт `portal_has_project(text)` и `portal_has_rate_card_project(uuid)`.
Ничем не вызываются ни в одной политике — применение этой миграции **не
меняет наблюдаемое поведение** ни для одной роли.

- [x] Применено. Подтверждено: `select proname from pg_proc where proname in
      ('portal_has_project', 'portal_has_rate_card_project')` вернул обе
      строки.

---

## Фаза B — read-only аудит покрытия проектов

Цель: до включения фильтра убедиться, что ни один активный не-`head`
пользователь не потеряет доступ к данным, которые видит сегодня.

### Результат (3 августа 2026)

Блок 1 (живые таблицы — `candidates`/`staffing_demand`/`staffing_demand_rows`/
`addresses`/`rate_cards`): **все пять** встречающихся в данных проектов
(«Газпромнефть», «Купер», «Мастер Деливери Таксопарк», «Самокат», «Яндекс
Лавка») показали `has_non_head_coverage = false`.

Блок 2 (`staffing_demand_history`, отдельно от живых таблиц — read-only,
триггерная, другой жизненный цикл): три проекта («Купер», «Самокат», «Яндекс
Лавка») тоже `false`, но все три `still_in_live_tables = true` — то есть это
не отдельная историческая проблема, а то же самое явление, что и в блоке 1,
просто видимое и в истории тоже. Отдельно «осиротевших» проектов (которые
есть только в истории и нигде в живых таблицах) на момент проверки не
обнаружено.

**Причина, установленная отдельным запросом** (`select ... from
portal_users where role <> 'head'` → **0 строк**): на момент выката в системе
**нет ни одной активной учётной записи роли, отличной от `head`**. Нулевое
покрытие — не рассинхронизация данных и не ошибка назначения проектов, а
отсутствие таких пользователей как класса. Реального доступа никто не
теряет: единственная существующая на сегодня роль (`head`) проходит bypass
по решению №1.

**Вывод: фаза C безопасна для текущего состояния данных.** Это не то же
самое, что «проверено на реальных координаторах» — их просто пока нет.

> ⚠️ **Операционное следствие, которое нужно держать в голове при заведении
> первого не-`head` пользователя.** В момент создания первой учётной записи
> координатора/менеджера/рекрутёра в «Настройки → Команда и роли»
> администратору нужно **вручную назначить ей правильные проекты** — иначе
> этот пользователь увидит ноль данных ни в одном проектном разделе, и это
> будет выглядеть как баг, а не как последствие незаполненного поля. Стоит
> явно проговорить это тому, кто заводит первых реальных сотрудников.

- [x] Аудит выполнен, результат зафиксирован выше.

---

## Backup — точные определения 22 политик до фазы C

Сохранено **до** применения фазы C, а не в момент инцидента. Дословные
определения из исходных миграций (`20260728120000_portal_auth.sql`,
`20260729130100_addresses_rls_policies.sql`,
`20260731100200_rates_rls_policies.sql`).

```sql
-- === candidates ===
drop policy if exists "portal_select_candidates" on public.candidates;
drop policy if exists "portal_insert_candidates" on public.candidates;
drop policy if exists "portal_update_candidates" on public.candidates;

create policy "portal_select_candidates"
  on public.candidates for select to authenticated
  using (public.portal_can('candidates'));
create policy "portal_insert_candidates"
  on public.candidates for insert to authenticated
  with check (public.portal_can('candidates'));
create policy "portal_update_candidates"
  on public.candidates for update to authenticated
  using (public.portal_can('candidates'))
  with check (public.portal_can('candidates'));

-- === staffing_demand ===
drop policy if exists "portal_select_staffing_demand" on public.staffing_demand;
drop policy if exists "portal_insert_staffing_demand" on public.staffing_demand;
drop policy if exists "portal_update_staffing_demand" on public.staffing_demand;
drop policy if exists "portal_delete_staffing_demand" on public.staffing_demand;

create policy "portal_select_staffing_demand"
  on public.staffing_demand for select to authenticated
  using (public.portal_can('demand'));
create policy "portal_insert_staffing_demand"
  on public.staffing_demand for insert to authenticated
  with check (public.portal_can('demand'));
create policy "portal_update_staffing_demand"
  on public.staffing_demand for update to authenticated
  using (public.portal_can('demand'))
  with check (public.portal_can('demand'));
create policy "portal_delete_staffing_demand"
  on public.staffing_demand for delete to authenticated
  using (public.portal_can('demand'));

-- === staffing_demand_rows ===
drop policy if exists "portal_select_staffing_demand_rows" on public.staffing_demand_rows;
drop policy if exists "portal_insert_staffing_demand_rows" on public.staffing_demand_rows;
drop policy if exists "portal_update_staffing_demand_rows" on public.staffing_demand_rows;

create policy "portal_select_staffing_demand_rows"
  on public.staffing_demand_rows for select to authenticated
  using (public.portal_can('demand'));
create policy "portal_insert_staffing_demand_rows"
  on public.staffing_demand_rows for insert to authenticated
  with check (public.portal_can('demand'));
create policy "portal_update_staffing_demand_rows"
  on public.staffing_demand_rows for update to authenticated
  using (public.portal_can('demand'))
  with check (public.portal_can('demand'));

-- === staffing_demand_history (select-only) ===
drop policy if exists "portal_select_staffing_demand_history" on public.staffing_demand_history;

create policy "portal_select_staffing_demand_history"
  on public.staffing_demand_history for select to authenticated
  using (public.portal_can('demand'));

-- === addresses ===
drop policy if exists "portal_select_addresses" on public.addresses;
drop policy if exists "portal_insert_addresses" on public.addresses;
drop policy if exists "portal_update_addresses" on public.addresses;

create policy "portal_select_addresses"
  on public.addresses for select to authenticated
  using (public.portal_can('addresses'));
create policy "portal_insert_addresses"
  on public.addresses for insert to authenticated
  with check (public.portal_can('addresses'));
create policy "portal_update_addresses"
  on public.addresses for update to authenticated
  using (public.portal_can('addresses'))
  with check (public.portal_can('addresses'));

-- === rate_cards ===
drop policy if exists "portal_select_rate_cards" on public.rate_cards;
drop policy if exists "portal_insert_rate_cards" on public.rate_cards;
drop policy if exists "portal_update_rate_cards" on public.rate_cards;
drop policy if exists "portal_delete_rate_cards" on public.rate_cards;

create policy "portal_select_rate_cards"
  on public.rate_cards for select to authenticated
  using (public.portal_can('rates'));
create policy "portal_insert_rate_cards"
  on public.rate_cards for insert to authenticated
  with check (public.portal_can('rates'));
create policy "portal_update_rate_cards"
  on public.rate_cards for update to authenticated
  using (public.portal_can('rates'))
  with check (public.portal_can('rates'));
create policy "portal_delete_rate_cards"
  on public.rate_cards for delete to authenticated
  using (public.portal_can('rates'));

-- === rates ===
drop policy if exists "portal_select_rates" on public.rates;
drop policy if exists "portal_insert_rates" on public.rates;
drop policy if exists "portal_update_rates" on public.rates;
drop policy if exists "portal_delete_rates" on public.rates;

create policy "portal_select_rates"
  on public.rates for select to authenticated
  using (public.portal_can('rates'));
create policy "portal_insert_rates"
  on public.rates for insert to authenticated
  with check (public.portal_can('rates'));
create policy "portal_update_rates"
  on public.rates for update to authenticated
  using (public.portal_can('rates'))
  with check (public.portal_can('rates'));
create policy "portal_delete_rates"
  on public.rates for delete to authenticated
  using (public.portal_can('rates'));
```

- [x] Backup сохранён (этот раздел) до применения фазы C.

---

## Фаза C — переписывание 22 политик

**Файл:** `supabase/migrations/20260803140000_project_scoped_rls_policies.sql`.

**Аномалия при применении, зафиксирована честно.** Первая попытка выполнить
весь файл одним запросом в SQL Editor дважды подряд отчиталась «Success. No
rows returned», но последующая проверка `pg_policies` показывала **старые**
определения (только `portal_can(...)`, без `portal_has_project`) — то есть
либо весь батч из 22 пар `drop`/`create` не применился, либо применился и
незаметно откатился. Причина не установлена (возможно, ошибка где-то в
середине батча тихо откатывает всю неявную транзакцию, а редактор не
показывает это явно) — воспроизвести и продиагностировать не стали, вместо
этого применили тот же самый SQL **по одной таблице за раз** (7 отдельных
запросов вместо одного), с проверкой `pg_policies` после каждого. Все 7
применились корректно с первого раза при таком разбиении. Итоговое
состояние политик идентично тому, что должен был дать оригинальный файл
миграции — расхождения в самом SQL не было, только в способе его подачи в
редактор.

- [x] Применено (по частям, см. выше).
- [x] `pg_policies` проверен — все 22 политики содержат `portal_has_project`
      (или `portal_has_rate_card_project` для `rates`) в определении.
- [x] Фактические запросы через PostgREST под токенами разных ролей — не
      только анализ SQL-текста политик. Токены подписаны локально тем же
      кодом, что использует сам портал (`signPortalJwt`), под реального
      тестового `recruiter` (единственный проект — «Самокат») и реального
      `head`. Полная таблица результатов — в `tasks/completed.md`; кратко:
      `SELECT` под рекрутёром возвращает только «Самокат» во всех
      применимых таблицах; `INSERT`/`UPDATE` в чужой проект — `403 42501`
      от PostgREST; в свой проект — проходит; `head` видит несколько
      проектов сразу без ограничения. `rate_cards`/`rates` для «Самокат»
      оказались пустыми у рекрутёра — проверено через `head`, что для
      этого проекта физически нет данных, это не дефект.

---

## Фаза D — деплой кода (UI-сужение фильтров)

- [x] `src/lib/auth/projectAccess.ts` + тесты (`projectAccess.test.ts`, 5
      тестов).
- [x] 10 мест использования обновлены (в исходном ТЗ ошибочно посчитано
      как 9) — `CandidatesSection.tsx`,
      `AddCandidateModal.tsx`, `RealCandidateDrawer.tsx`,
      `AddressesSection.tsx`, `AddAddressModal.tsx`, `AddressDrawer.tsx`,
      `DemandSection.tsx`, `AddDemandModal.tsx`, `RatesSection.tsx`,
      `AddRateModal.tsx`. `UserFormModal.tsx` не тронут (там `head` выбирает
      проекты для чужой учётной записи, а не свои собственные).
- [x] `tsc`/`lint`/`test`/`build` зелёные (232 теста).

---

## Rollback

Фаза C — выполнить блок «Backup» выше целиком (он и есть скрипт отката).
Фаза A (функции) можно не трогать при откате фазы C — если их никто не
вызывает, они безвредны; удалять отдельно, только когда откат подтверждён
рабочим. Фаза D — откат деплоя в Vercel, независимо от состояния БД.
