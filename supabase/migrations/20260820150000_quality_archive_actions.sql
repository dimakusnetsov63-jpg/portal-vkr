-- TASK-013, фаза B1 аудита (DATA-02): два события журнала под архивацию
-- проверки.
--
-- Отдельные значения, а не `quality_review_updated` с признаком в details:
-- в «Настройки → Журнал действий» строка должна читаться сама по себе.
-- «Изменил проверку качества» там, где на самом деле её убрали из
-- статистики, — ровно та неточность, из-за которой журналам перестают
-- доверять.
--
-- Отдельным файлом, как все правки enum: Postgres не даёт использовать
-- новое значение в транзакции, которая его создала.

alter type public.portal_audit_action add value if not exists 'quality_review_archived';
alter type public.portal_audit_action add value if not exists 'quality_review_restored';
