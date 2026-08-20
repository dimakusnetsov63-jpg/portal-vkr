-- TASK-013, фаза B1: исправление типа значения в записи журнала.
--
-- Ошибка, найденная RLS-тестом сразу после выката 20260820150100:
-- архивация падала у любого легитимного вызывающего, потому что действие
-- журнала выбиралось выражением
--
--   case when p_archived then 'quality_review_archived' else ... end
--
-- а CASE из двух нетипизированных литералов резолвится в text. Вставка
-- text в колонку типа portal_audit_action без явного приведения запрещена,
-- и функция падала на последнем шаге — уже после того, как проверила права
-- и обновила строку (вся транзакция откатывалась).
--
-- Проверено на боевой базе:
--   select pg_typeof(case when true then 'quality_review_archived'
--                         else 'quality_review_restored' end)  -->  text
--   select pg_typeof('quality_review_archived')                -->  unknown
--
-- Почему это не всплыло в C5: там значения записывались голыми литералами
-- прямо в VALUES, а нетипизированный литерал Postgres приводит к типу
-- колонки сам. Ломается именно CASE — он определяет свой тип раньше, чем
-- узнаёт, куда его вставляют.
--
-- Почему не поймала проверка после применения: тело plpgsql проверяется на
-- типы при вызове, а не при создании. Убедиться, что функция существует, —
-- не то же самое, что убедиться, что она работает.

create or replace function public.portal_archive_quality_review(
  p_review_id uuid,
  p_archived boolean
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_review public.quality_reviews%rowtype;
  v_actor uuid := public.portal_current_user_id();
  v_actor_login text;
begin
  if not public.portal_can_edit_section('quality') then
    raise exception 'Недостаточно прав для архивации проверки' using errcode = '42501';
  end if;

  select * into v_review from public.quality_reviews where id = p_review_id for update;
  if not found then
    raise exception 'Проверка не найдена' using errcode = 'P0002';
  end if;

  -- Тот же проектный гейт, что и у сохранения (SEC-01): архивировать чужую
  -- проверку, зная её id, нельзя.
  if not public.portal_has_project(v_review.project) then
    raise exception 'Нет доступа к проекту этой проверки' using errcode = '42501';
  end if;

  -- Версию намеренно не спрашиваем и не двигаем. Архивация не переписывает
  -- содержимое проверки, поэтому конфликтовать с чьей-то открытой формой ей
  -- не с чем: та сохранит свои правки, проверка останется архивной.
  update public.quality_reviews
  set archived_at = case when p_archived then now() else null end
  where id = p_review_id;

  select login into v_actor_login from public.portal_users where id = v_actor;

  insert into public.portal_audit_log (action, actor_id, actor_login, details)
  values (
    case when p_archived
         then 'quality_review_archived'::public.portal_audit_action
         else 'quality_review_restored'::public.portal_audit_action end,
    v_actor,
    v_actor_login,
    jsonb_build_object(
      'review_id', p_review_id,
      'crm_lead_id', v_review.crm_lead_id,
      'employee_name', v_review.employee_name,
      'project', v_review.project,
      'total_score', v_review.total_score
    )
  );

  return jsonb_build_object('id', p_review_id, 'archived', p_archived);
end;
$$;

comment on function public.portal_archive_quality_review(uuid, boolean) is
  'Убирает проверку из работы и из отчётности (или возвращает обратно). Требует can_edit(quality) и доступа к проекту строки. Версию не спрашивает: архивация не переписывает содержимое и ничьей открытой формы не ломает. Пишет событие в portal_audit_log.';

revoke execute on function public.portal_archive_quality_review(uuid, boolean) from public;
grant execute on function public.portal_archive_quality_review(uuid, boolean) to authenticated;

