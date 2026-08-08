-- Termination/return fields for the candidate card.
--
-- termination_reason / return_reason: free text with curated suggestions —
-- the same model already used for recruiter/manager/coordinator/city/
-- position (candidate_list_type values added in the previous migration).
-- The reference lists guide input but do not constrain what can be stored.
-- No seed rows here on purpose: unlike positions/vacancy categories, the
-- business has not supplied a fixed set of reasons yet — the lists start
-- empty and are populated in Настройки → Списки для кандидатов.
--
-- terminated_at: дата увольнения, timestamptz to match the rest of the
-- candidate timeline (invitation_at/registration_at/first_shift_at).

alter table public.candidates add column if not exists termination_reason text;
alter table public.candidates add column if not exists terminated_at timestamptz;
alter table public.candidates add column if not exists return_reason text;

comment on column public.candidates.termination_reason is
  'Причина увольнения. Свободный текст; подсказки курируются в candidate_list_options (list_type = termination_reason), значение ими не ограничено.';
comment on column public.candidates.terminated_at is
  'Дата увольнения. NULL = не увольнялся (или дата не указана).';
comment on column public.candidates.return_reason is
  'Причина возвращения кандидата после увольнения. Свободный текст; подсказки курируются в candidate_list_options (list_type = return_reason), значение ими не ограничено.';

create index if not exists idx_candidates_terminated_at on public.candidates (terminated_at);
