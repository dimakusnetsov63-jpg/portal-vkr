-- Сводит список проектов в один управляемый справочник по всему порталу.
--
-- До этой миграции список проектов существовал в двух не связанных друг с
-- другом местах: enum public.candidate_project (12 жёстких значений,
-- типизировал candidates.project / staffing_demand.project /
-- addresses.project) и public.candidate_list_options (list_type = 'project',
-- свободный список, которым пользовались только «Ставки», 25 значений —
-- первые 12 дословно совпадают с enum). Расширить enum новым клиентом можно
-- было только миграцией; расширить второй список — можно было в
-- «Настройки → Списки» без единой строки SQL. По итогам обсуждения раздела
-- «Ставки» принято решение: везде должен быть один список, расширяемый без
-- миграций, — тот, что уже используют «Ставки».
--
-- Перенос безопасен для данных: candidate_list_options (list_type='project')
-- уже содержит все 12 значений enum дословно (см. seed в
-- 20260731100100_create_rates.sql), то есть любое текущее значение
-- candidates.project / staffing_demand.project / addresses.project гарантированно
-- есть в целевом списке.
--
-- `alter column ... type text using project::text` не трогает данные и
-- существующие индексы по `project` — Postgres перестраивает их автоматически
-- как часть той же команды.
--
-- Сам enum public.candidate_project НЕ удаляется — просто больше не
-- используется как тип колонки. Удалять его отдельной командой рискованнее,
-- чем оставить неиспользуемым: на него по имени ссылается
-- portal_bootstrap_admin() (единоразовая функция создания первого
-- администратора, уже выполнившая свою работу и защищённая проверкой
-- «таблица пользователей пуста» — при отсутствии enum эта историческая
-- миграция просто перестала бы быть воспроизводимой на новом стенде, а
-- пересоздавать её сейчас незачем).

alter table public.candidates
  alter column project type text using project::text;

alter table public.staffing_demand
  alter column project type text using project::text;

alter table public.addresses
  alter column project type text using project::text;

comment on column public.candidates.project is
  'Проект кандидата. Свободный текст; подсказки курируются в candidate_list_options (list_type = project), список расширяется в Настройках без миграции. До 20260731120000 было enum candidate_project (12 жёстких значений) — при миграции подставлено дословное текстовое значение.';
comment on column public.staffing_demand.project is
  'Проект строки потребности. Свободный текст, тот же справочник, что candidates.project — candidate_list_options (list_type = project). До 20260731120000 было enum candidate_project.';
comment on column public.addresses.project is
  'Проект объекта. Свободный текст, тот же справочник, что candidates.project — candidate_list_options (list_type = project). До 20260731120000 было enum candidate_project.';
