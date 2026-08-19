-- TASK-013: RLS-политики и табличные гранты раздела «Контроль качества».
--
-- Модель та же, что после фазы C ADR-005: чтение спрашивает
-- portal_can_view_section('quality'), запись — portal_can_edit_section.
-- Проектная изоляция H-6 (portal_has_project) применяется к проверкам —
-- они привязаны к проекту; к шаблонам не применяется: чек-лист проекта
-- нужно видеть и тому, кто настраивает раздел целиком.
--
-- Асимметрия, которую стоит проговорить: у quality_reviews и
-- quality_review_scores есть только SELECT-политика. Запись идёт
-- исключительно через public.portal_save_quality_review (20260818100400) —
-- SECURITY DEFINER, то есть политики она обходит и проверяет право сама.
-- Прямой INSERT/UPDATE из браузера не нужен и вреден: total_score
-- вычисляется из ответов, и разрешить писать его напрямую значило бы
-- позволить прислать любой процент независимо от проставленных баллов.
-- Отсутствующая политика здесь — не забытая, а решение; гранты ниже
-- закрывают ту же дверь на уровне привилегий Postgres.

-- Шаблоны ----------------------------------------------------------------
create policy "portal_select_quality_checklists"
  on public.quality_checklists for select to authenticated
  using (public.portal_can_view_section('quality'));

create policy "portal_insert_quality_checklists"
  on public.quality_checklists for insert to authenticated
  with check (public.portal_can_edit_section('quality'));

create policy "portal_update_quality_checklists"
  on public.quality_checklists for update to authenticated
  using (public.portal_can_edit_section('quality'))
  with check (public.portal_can_edit_section('quality'));

create policy "portal_select_quality_checklist_groups"
  on public.quality_checklist_groups for select to authenticated
  using (public.portal_can_view_section('quality'));

create policy "portal_insert_quality_checklist_groups"
  on public.quality_checklist_groups for insert to authenticated
  with check (public.portal_can_edit_section('quality'));

create policy "portal_update_quality_checklist_groups"
  on public.quality_checklist_groups for update to authenticated
  using (public.portal_can_edit_section('quality'))
  with check (public.portal_can_edit_section('quality'));

-- DELETE у блоков и пунктов есть: пока на пункт не сослалась ни одна
-- проверка, его удаление из свежесозданного шаблона — нормальная правка, а
-- не потеря истории. Как только ссылка появится, удаление остановит
-- `on delete restrict` у quality_review_scores.item_id, и останется
-- архивация.
create policy "portal_delete_quality_checklist_groups"
  on public.quality_checklist_groups for delete to authenticated
  using (public.portal_can_edit_section('quality'));

create policy "portal_select_quality_checklist_items"
  on public.quality_checklist_items for select to authenticated
  using (public.portal_can_view_section('quality'));

create policy "portal_insert_quality_checklist_items"
  on public.quality_checklist_items for insert to authenticated
  with check (public.portal_can_edit_section('quality'));

create policy "portal_update_quality_checklist_items"
  on public.quality_checklist_items for update to authenticated
  using (public.portal_can_edit_section('quality'))
  with check (public.portal_can_edit_section('quality'));

create policy "portal_delete_quality_checklist_items"
  on public.quality_checklist_items for delete to authenticated
  using (public.portal_can_edit_section('quality'));

-- Проверки ---------------------------------------------------------------
create policy "portal_select_quality_reviews"
  on public.quality_reviews for select to authenticated
  using (public.portal_can_view_section('quality') and public.portal_has_project(project));

-- Ответы по пунктам видны ровно тогда, когда видна сама проверка: у них
-- нет своей колонки project, и повторять проектный гейт «на глаз» нельзя —
-- он выводится через строку проверки.
create policy "portal_select_quality_review_scores"
  on public.quality_review_scores for select to authenticated
  using (
    public.portal_can_view_section('quality')
    and exists (
      select 1
      from public.quality_reviews r
      where r.id = quality_review_scores.review_id
        and public.portal_has_project(r.project)
    )
  );

-- Гранты -----------------------------------------------------------------
-- Явно и поимённо, по правилу SEC-3 (20260813110000): полагаться на
-- auto_expose_new_tables нельзя — флаг удаляется из CLI 30 октября 2026, и
-- без этих строк эфемерная база в CI не получит прав вовсе.
-- У самих шаблонов delete не выдан: шаблон архивируется (archived_at), а
-- не удаляется — на него ссылаются проверки. Блоки и пункты удалять можно,
-- пока на них никто не сослался (см. комментарий у их DELETE-политик).
grant select, insert, update on public.quality_checklists to authenticated;
grant select, insert, update, delete on public.quality_checklist_groups to authenticated;
grant select, insert, update, delete on public.quality_checklist_items to authenticated;

-- Только чтение: писать проверки может лишь RPC. У quality_checklists
-- delete не выдан по той же логике — шаблоны архивируются.
grant select on public.quality_reviews to authenticated;
grant select on public.quality_review_scores to authenticated;

grant select, insert, update, delete on public.quality_checklists to service_role;
grant select, insert, update, delete on public.quality_checklist_groups to service_role;
grant select, insert, update, delete on public.quality_checklist_items to service_role;
grant select, insert, update, delete on public.quality_reviews to service_role;
grant select, insert, update, delete on public.quality_review_scores to service_role;
