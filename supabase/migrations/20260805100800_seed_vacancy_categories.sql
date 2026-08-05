-- Seeds the same 7 categories the old static vacancyData.ts used
-- (VACANCY_CATEGORY_LABELS), so the migration to real data changes nothing
-- about the existing filter chips in "Описание вакансии". Curated further
-- in Настройки → Списки → «Категории вакансий» — new categories (e.g.
-- darkstore/delivery/marketplace) are added there, no migration needed.

insert into public.candidate_list_options (list_type, value, sort_order, is_active)
values
  ('vacancy_category', 'Курьеры и доставка', 0, true),
  ('vacancy_category', 'Склад и сборка', 1, true),
  ('vacancy_category', 'Логистика и водители', 2, true),
  ('vacancy_category', 'Розница и общепит', 3, true),
  ('vacancy_category', 'Производство', 4, true),
  ('vacancy_category', 'Координация и поддержка', 5, true),
  ('vacancy_category', 'Справочники', 6, true)
on conflict (list_type, value) do nothing;
