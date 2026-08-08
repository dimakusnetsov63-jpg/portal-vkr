-- Adds 'Уволился' (terminated/quit) as a fifth value of candidate_stage, so
-- the candidate card can record that someone left without inventing a
-- separate status column. Deliberately alone in its own migration: Postgres
-- does not allow a newly added enum value to be USED in the same
-- transaction that adds it, and `supabase db push` runs each migration file
-- in a transaction — same reason as 20260725100000_add_position_list_type.sql.
--
-- Excluded from SUCCESSFUL_STAGES (src/lib/portal/candidateOptions.ts): a
-- candidate who quit is not a successful outcome, even though the stage sits
-- after 'Прибыл на проект' in enum declaration order.

alter type public.candidate_stage add value if not exists 'Уволился';
