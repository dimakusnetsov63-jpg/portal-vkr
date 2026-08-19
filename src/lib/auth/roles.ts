import type { PortalPage } from "@/lib/portal/types";

/**
 * Роли портала и то, что каждой из них доступно.
 *
 * Чистый модуль без React, Supabase и next/*: используется и в браузере,
 * и в middleware (Edge runtime), и в тестах.
 *
 * ⚠️ ЭТОТ ФАЙЛ БОЛЬШЕ НЕ ЯВЛЯЕТСЯ ИСТОЧНИКОМ ПРАВДЫ ДЛЯ ПРАВ.
 *
 * С фазы D (ADR-005) права приходят с сервера — из таблицы
 * `portal_section_permissions` через `portal_user_json()`, той же, на
 * которую смотрит RLS. Интерфейс читает их из `currentUser.permissions`
 * (см. `permissions.ts` и `PortalContext`), а не отсюда.
 *
 * `ROLE_PERMISSIONS` ниже сохранена ровно для трёх целей:
 *
 *   1. запасной путь в `middleware.ts` — на случай, когда код выкачен
 *      раньше миграций и `permissions` в ответе RPC ещё нет;
 *   2. сверка baseline в тестах (`sectionPermissionsSeed.test.ts`,
 *      `sectionPermissions.rls-test.ts`): она ловит расхождение между кодом
 *      и базой, поэтому удалять её нельзя — иначе некому будет заметить,
 *      что seed уехал;
 *   3. значение, от которого отсчитывается смысл «как было до появления
 *      настраиваемых прав».
 *
 * **Править её, чтобы выдать или отобрать право, бессмысленно** — на
 * работающий портал это не повлияет. Права меняются в интерфейсе
 * «Настройки → Доступы», который пишет в базу.
 */

export const PORTAL_ROLES = ["head", "coordinator", "manager", "recruiter"] as const;

export type PortalRole = (typeof PORTAL_ROLES)[number];

export const ROLE_LABELS: Record<PortalRole, string> = {
  head: "Руководитель",
  coordinator: "Координатор",
  manager: "Менеджер",
  recruiter: "Рекрутер",
};

/**
 * Право = раздел портала, плюс `users` — управление учётными записями.
 * `users` не пункт меню: это панель «Команда и роли» внутри «Настроек».
 */
export type PortalPermission = PortalPage | "users";

/** Порядок разделов в меню — им же определяется стартовый раздел роли. */
const SECTION_ORDER: PortalPage[] = [
  "overview",
  "demand",
  "addresses",
  "candidates",
  "vacancies",
  "rates",
  "quality",
  "marketing",
  "analytics",
  "notifications",
  "settings",
];

// "Адреса", "Ставки" и "Уведомления" — единственные разделы, которые видят
// все четыре роли (в отличие от остальных, которые ограничены по ролям):
// рекрутёру нужно называть кандидату актуальную ставку так же, как
// координатору и менеджеру — сверять её с условиями клиента. См.
// docs/requirements/addresses.md и docs/requirements/rates.md.
//
// "Контроль качества" (TASK-013) — обратный случай: раздела нет у
// recruiter, а у manager он только на чтение (в этой матрице отражается
// лишь can_view, разделение VIEW/EDIT живёт в portal_section_permissions).
// Причина не в секретности оценок, а в отсутствующей возможности: доступ
// рекрутёра к СВОИМ проверкам требует политики «своя строка», которой в
// портале нет — изоляция работает по проектам. См. docs/requirements/quality.md.
const ROLE_PERMISSIONS: Record<PortalRole, readonly PortalPermission[]> = {
  head: [...SECTION_ORDER, "users"],
  coordinator: [
    "overview",
    "demand",
    "addresses",
    "candidates",
    "vacancies",
    "rates",
    "quality",
    "marketing",
    "analytics",
    "notifications",
    "settings",
  ],
  manager: ["overview", "demand", "addresses", "candidates", "vacancies", "rates", "quality", "notifications"],
  recruiter: ["addresses", "candidates", "vacancies", "rates", "notifications"],
};

export function isPortalRole(value: unknown): value is PortalRole {
  return typeof value === "string" && (PORTAL_ROLES as readonly string[]).includes(value);
}

export function isPortalPage(value: unknown): value is PortalPage {
  return typeof value === "string" && (SECTION_ORDER as string[]).includes(value);
}

export function permissionsForRole(role: PortalRole): readonly PortalPermission[] {
  return ROLE_PERMISSIONS[role];
}

export function canAccess(role: PortalRole, permission: PortalPermission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** Разделы роли в порядке меню. */
export function allowedSections(role: PortalRole): PortalPage[] {
  return SECTION_ORDER.filter((section) => canAccess(role, section));
}

// `defaultPageForRole` жила здесь и решала, куда попадает пользователь
// после входа. Удалена в фазе E: выбор стартового раздела перешёл к
// серверной матрице — `firstViewableSection` в `permissions.ts`. Оставлять
// её значило бы держать второй ответ на тот же вопрос, который разошёлся
// бы с первым при первом же изменении прав через настройки.
