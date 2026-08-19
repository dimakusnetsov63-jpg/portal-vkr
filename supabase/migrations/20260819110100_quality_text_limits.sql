-- TASK-013, фаза A аудита (SEC-03): ограничения длины текстовых полей.
--
-- До этой миграции ни одно текстовое поле раздела не было ограничено сверху
-- — только `char_length(btrim(...)) > 0` там, где значение обязательно.
-- Пользователь с правом записи мог положить в комментарий мегабайты: база
-- растёт, реестр и карточка ломаются по вёрстке, ответы API тяжелеют. Это
-- не гипотеза про злоумышленника — достаточно вставки из буфера обмена.
--
-- Пределы выбраны с запасом к фактическим данным (проверено перед
-- применением: самый длинный пункт чек-листа — 156 символов, самое длинное
-- имя сотрудника — 16, комментарии пока пустые):
--   200  — имена, справочные значения (сотрудник, проверяющий, должность,
--          город, возражение, нарушение, названия шаблонов и блоков);
--   500  — формулировка пункта чек-листа (в исходных файлах встречаются
--          длинные, с пояснением в скобках);
--   1000 — заметка к пункту;
--   4000 — свободные комментарии (рекомендации, комментарий из CRM,
--          описание кейса).
--
-- Ограничения ставятся именно в базе, а не только `maxLength` в форме:
-- запись идёт через RPC, и любой клиент мимо интерфейса обходит проверку
-- на стороне UI.

alter table public.quality_reviews
  add constraint quality_reviews_employee_name_len check (char_length(employee_name) <= 200),
  add constraint quality_reviews_reviewer_name_len check (char_length(reviewer_name) <= 200),
  add constraint quality_reviews_position_len check (position is null or char_length(position) <= 200),
  add constraint quality_reviews_city_len check (city is null or char_length(city) <= 200),
  add constraint quality_reviews_objection_len check (objection is null or char_length(objection) <= 200),
  add constraint quality_reviews_violation_len check (violation is null or char_length(violation) <= 200),
  add constraint quality_reviews_handling_speed_len check (handling_speed is null or char_length(handling_speed) <= 200),
  add constraint quality_reviews_crm_comment_len check (crm_comment is null or char_length(crm_comment) <= 4000),
  add constraint quality_reviews_recommendations_len check (recommendations is null or char_length(recommendations) <= 4000),
  add constraint quality_reviews_case_comment_len check (case_comment is null or char_length(case_comment) <= 4000);

alter table public.quality_review_scores
  add constraint quality_review_scores_note_len check (note is null or char_length(note) <= 1000);

alter table public.quality_checklists
  add constraint quality_checklists_title_len check (char_length(title) <= 200),
  add constraint quality_checklists_project_len check (project is null or char_length(project) <= 200);

alter table public.quality_checklist_groups
  add constraint quality_checklist_groups_title_len check (char_length(title) <= 200);

alter table public.quality_checklist_items
  add constraint quality_checklist_items_title_len check (char_length(title) <= 500);
