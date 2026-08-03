import type { PortalRole } from "./roles";

/**
 * Клиентское зеркало проектного фильтра (H-6). Как и `roles.ts`/`portal_can`,
 * это не защита сама по себе — настоящий рубеж всегда RLS
 * (`portal_has_project`/`portal_has_rate_card_project` в базе, миграция
 * `20260803140000_project_scoped_rls_policies.sql`). Здесь только убираем из
 * интерфейса выбор проекта, к которому у пользователя всё равно нет доступа:
 * без этого фильтр показывал бы чужой проект с вечно пустым результатом, а
 * форма создания — принимала бы значение, которое база потом отклонит.
 *
 * `head` — bypass, как и на уровне RLS: видит полный список без сужения.
 */
export function visibleProjectOptions(
  role: PortalRole,
  userProjects: readonly string[],
  allOptions: readonly string[],
): string[] {
  if (role === "head") return [...allOptions];
  return allOptions.filter((project) => userProjects.includes(project));
}
