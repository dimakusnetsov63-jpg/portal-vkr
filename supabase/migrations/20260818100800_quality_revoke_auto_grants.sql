-- TASK-013, находка при применении: явных GRANT'ов недостаточно, нужен
-- предварительный REVOKE.
--
-- Что обнаружено сразу после применения 20260818100300. Ожидалось, что у
-- `authenticated` окажутся ровно те привилегии, которые выданы поимённо, а у
-- `anon` — никаких. Фактически обе роли получили на все пять таблиц
-- `SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER`.
--
-- Причина: legacy-поведение платформы `auto_expose_new_tables` на этом
-- проекте **всё ещё включено**. Его event trigger выдаёт полный набор прав
-- при каждом CREATE TABLE. SEC-3 (20260813110000) вычистил права у таблиц,
-- существовавших на тот момент, но сам триггер не отключал — и на новых
-- таблицах всё повторилось. GRANT только добавляет привилегии, поэтому
-- явные гранты предыдущей миграции ничего не отняли: они были подмножеством
-- уже выданного.
--
-- Почему это не «косметика прав». RLS закрывает SELECT/INSERT/UPDATE/DELETE
-- (у `anon` нет ни одной политики на этих таблицах), но **TRUNCATE через
-- RLS не проходит вовсе** — это табличная привилегия, политики к ней не
-- применяются. То есть право стереть таблицу целиком было выдано роли,
-- которой соответствует публикуемый ключ.
--
-- Вывод на будущее, который стоит держать в голове при добавлении любой
-- новой таблицы: миграция обязана начинаться с REVOKE, а не сразу с GRANT.
-- Проверка «выданы ли лишние права» — обязательный шаг после применения, а
-- не необязательный (см. docs/database/migrations.md).

revoke all on public.quality_checklists from anon, authenticated;
revoke all on public.quality_checklist_groups from anon, authenticated;
revoke all on public.quality_checklist_items from anon, authenticated;
revoke all on public.quality_reviews from anon, authenticated;
revoke all on public.quality_review_scores from anon, authenticated;

-- Ровно то, что разрешают политики каждой таблицы, — как в SEC-3.
-- У шаблонов нет DELETE: они архивируются (`archived_at`), на них ссылаются
-- проверки. У блоков и пунктов DELETE есть — пока на пункт не сослалась ни
-- одна проверка, дальше останавливает `on delete restrict`.
grant select, insert, update on public.quality_checklists to authenticated;
grant select, insert, update, delete on public.quality_checklist_groups to authenticated;
grant select, insert, update, delete on public.quality_checklist_items to authenticated;

-- Только чтение: проверки пишет исключительно
-- public.portal_save_quality_review (SECURITY DEFINER), которая
-- пересчитывает проценты из баллов. Прямая запись позволила бы прислать
-- любой total_score мимо проставленных оценок — см. ADR-006.
grant select on public.quality_reviews to authenticated;
grant select on public.quality_review_scores to authenticated;

-- `anon` не получает ничего: портал не обслуживает неаутентифицированных.
