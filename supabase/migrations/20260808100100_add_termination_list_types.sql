-- Adds 'termination_reason' (причина увольнения) and 'return_reason'
-- (причина возвращения) to the managed reference-list vocabulary, so the
-- candidate card offers curated suggestions for both fields (Настройки →
-- Списки для кандидатов), the same free-text-with-suggestions model already
-- used for recruiter/manager/coordinator/city/position.
--
-- Deliberately alone in its own migration, same reason as
-- 20260725100000_add_position_list_type.sql: Postgres does not allow a
-- newly added enum value to be USED in the same transaction that adds it.
-- The candidates.termination_reason/return_reason columns that use these
-- values live in the next migration.

alter type public.candidate_list_type add value if not exists 'termination_reason';
alter type public.candidate_list_type add value if not exists 'return_reason';
