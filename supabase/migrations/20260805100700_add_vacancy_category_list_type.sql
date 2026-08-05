-- Adds 'vacancy_category' to the managed reference-list vocabulary, so
-- vacancy_projects.category_option_id has a curated, portal-editable source
-- of values (Настройки → Списки) instead of the CHECK-constrained fixed set
-- the old static vacancyData.ts used.
--
-- Deliberately alone in its own migration, same reason as
-- 20260725100000_add_position_list_type.sql: Postgres does not allow a
-- newly added enum value to be USED in the same transaction that adds it,
-- and `supabase db push` runs each migration file in a transaction. The
-- seed rows that use 'vacancy_category' live in the next migration.

alter type public.candidate_list_type add value if not exists 'vacancy_category';
