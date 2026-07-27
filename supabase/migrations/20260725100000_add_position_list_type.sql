-- Adds 'position' (должность) to the managed reference-list vocabulary.
--
-- Deliberately alone in its own migration: Postgres does not allow a newly
-- added enum value to be USED in the same transaction that adds it, and
-- `supabase db push` runs each migration file in a transaction. The seed
-- rows that use 'position' therefore live in the next migration.

alter type public.candidate_list_type add value if not exists 'position';
