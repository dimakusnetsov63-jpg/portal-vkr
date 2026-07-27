-- Seeds the shared "Должности" reference list and gives candidates a
-- position field.
--
-- Positions are project-agnostic: any position can be used on any project,
-- so they live in the same managed list mechanism as cities/recruiters
-- (candidate_list_options) rather than being tied to candidate_project.
-- They are curated in Настройки → Списки для кандидатов: values can be
-- deactivated (is_active = false) and new ones added freely, with no
-- migration needed.
--
-- The list is intentionally flat, exactly as supplied by the business —
-- it mixes job titles (Курьер, Сборщик, Повар…), transport types (Авто,
-- Вело, Электровело, Пеший, Мото) and employment formats (Универсал,
-- Вахта) as sibling values.

insert into public.candidate_list_options (list_type, value, sort_order, is_active)
values
  ('position', 'Курьер', 0, true),
  ('position', 'Сборщик', 1, true),
  ('position', 'Кладовщик', 2, true),
  ('position', 'Кассир', 3, true),
  ('position', 'Повар', 4, true),
  ('position', 'Бариста', 5, true),
  ('position', 'Уборщик', 6, true),
  ('position', 'Экспедитор', 7, true),
  ('position', 'Контроллер-кассир', 8, true),
  ('position', 'Продавец', 9, true),
  ('position', 'Кухонный рабочий', 10, true),
  ('position', 'Грузчик', 11, true),
  ('position', 'Оператор кухни', 12, true),
  ('position', 'Оператор АЗС', 13, true),
  ('position', 'Авто', 14, true),
  ('position', 'Вело', 15, true),
  ('position', 'Электровело', 16, true),
  ('position', 'Пеший', 17, true),
  ('position', 'Мото', 18, true),
  ('position', 'Универсал', 19, true),
  ('position', 'Вахта', 20, true)
on conflict (list_type, value) do nothing;

-- Candidate position: free text with curated suggestions — the same model
-- already used for recruiter/manager/coordinator/city. The reference list
-- guides input but does not constrain what can be stored.
alter table public.candidates add column if not exists position text;

comment on column public.candidates.position is
  'Должность кандидата. Свободный текст; подсказки курируются в candidate_list_options (list_type = position), но значение ими не ограничено — как у recruiter/manager/coordinator/city.';

create index if not exists idx_candidates_position on public.candidates (position);
