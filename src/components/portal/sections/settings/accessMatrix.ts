import type { PortalRole } from "@/lib/auth/roles";
import type { SectionPermission, SectionPermissionRow } from "@/lib/supabase/portalAuth.types";

/**
 * Чистая логика панели «Доступы» — без React, поэтому тестируется напрямую.
 */

/** Матрица в удобной для интерфейса форме: роль → раздел → три флага. */
export type PermissionMatrix = Record<string, Record<string, SectionPermission>>;

/**
 * Порядок строк таблицы. Совпадает с порядком пунктов меню и с
 * `portal_section_order()` в базе; `users` — не раздел меню, а право
 * управлять учётными записями, поэтому идёт последним, как и в SQL.
 */
export const SECTION_ORDER: string[] = [
  "overview",
  "demand",
  "addresses",
  "candidates",
  "vacancies",
  "rates",
  "marketing",
  "analytics",
  "notifications",
  "settings",
  "users",
];

export const SECTION_LABELS: Record<string, string> = {
  overview: "Обзор",
  demand: "Потребность",
  addresses: "Адреса",
  candidates: "Кандидаты",
  vacancies: "Описание вакансий",
  rates: "Ставки",
  marketing: "Маркетинг",
  analytics: "Аналитика",
  notifications: "Уведомления",
  settings: "Настройки",
  users: "Учётные записи",
};

export function toMatrix(rows: SectionPermissionRow[]): PermissionMatrix {
  const matrix: PermissionMatrix = {};
  for (const row of rows) {
    matrix[row.role] = matrix[row.role] ?? {};
    matrix[row.role][row.section] = {
      visible: row.visible,
      can_view: row.can_view,
      can_edit: row.can_edit,
    };
  }
  return matrix;
}

/**
 * Разделы, реально присутствующие в матрице, в порядке меню. Незнакомые
 * (появившиеся в базе, но не в этом списке) не теряются — они уходят в
 * конец, иначе новый раздел молча выпал бы из интерфейса управления.
 */
export function sectionsInMenuOrder(matrix: PermissionMatrix): string[] {
  const present = new Set<string>();
  for (const sections of Object.values(matrix)) {
    for (const section of Object.keys(sections)) present.add(section);
  }
  const known = SECTION_ORDER.filter((section) => present.has(section));
  const unknown = [...present].filter((section) => !SECTION_ORDER.includes(section)).sort();
  return [...known, ...unknown];
}

/**
 * Ячейки, которые нельзя трогать: у роли `head` разделы «Настройки» и
 * «Учётные записи». Снять их — значит лишить портал единственного пути к
 * управлению доступами: вернуть право будет нечем, кроме SQL Editor.
 *
 * Сервер отвергает такую попытку самостоятельно
 * (`portal_admin_set_section_permission`), здесь — чтобы переключатель был
 * честно заблокирован, а не выдавал ошибку после клика.
 */
export function isLockedCell(role: PortalRole, section: string): boolean {
  return role === "head" && (section === "settings" || section === "users");
}
