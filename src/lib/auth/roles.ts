import type { PortalPage } from "@/lib/portal/types";

/**
 * Роли портала и то, что каждой из них доступно.
 *
 * Чистый модуль без React, Supabase и next/*: используется и в браузере,
 * и в middleware (Edge runtime), и в тестах.
 *
 * ВАЖНО: та же матрица продублирована в SQL —
 * `public.portal_role_sections()` в миграции `20260728120000_portal_auth.sql`.
 * Здесь она прячет недоступные разделы в интерфейсе, там — закрывает данные
 * по-настоящему. Меняется всегда в обоих местах: рассинхронизацию не поймают
 * ни типы, ни тесты, она проявится как «раздел видно, а данные не грузятся»
 * (или наоборот).
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
  "marketing",
  "analytics",
  "notifications",
  "settings",
];

// "Адреса" — единственный раздел, который видят все четыре роли (в отличие
// от остальных, которые ограничены по ролям): координатору, менеджеру и
// рекрутеру он нужен так же, как руководителю. См.
// docs/requirements/addresses.md.
const ROLE_PERMISSIONS: Record<PortalRole, readonly PortalPermission[]> = {
  head: [...SECTION_ORDER, "users"],
  coordinator: [
    "overview",
    "demand",
    "addresses",
    "candidates",
    "vacancies",
    "marketing",
    "analytics",
    "notifications",
    "settings",
  ],
  manager: ["overview", "demand", "addresses", "candidates", "vacancies", "notifications"],
  recruiter: ["addresses", "candidates", "vacancies", "notifications"],
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

/**
 * Куда попадает пользователь после входа: первый доступный ему раздел.
 * У рекрутера это «Кандидаты», а не «Обзор», которого он не видит.
 */
export function defaultPageForRole(role: PortalRole): PortalPage {
  return allowedSections(role)[0];
}
