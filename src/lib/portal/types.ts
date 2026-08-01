/**
 * Общие типы клиентской части, не привязанные ни к одному разделу.
 *
 * Типы данных разделов живут не здесь, а рядом со своим слоем доступа —
 * `lib/supabase/*.types.ts` (выведены из схемы БД). Здесь только то, что
 * описывает сам интерфейс.
 *
 * До C-7 файл содержал ещё тринадцать типов (`Candidate`, `Stage`,
 * `Project`, `Channel`, `PortalNotification`, `DemandMatrix`, `DemoState`…),
 * которые обслуживали исключительно сгенерированные данные. Они удалены
 * вместе с генераторами; настоящий кандидат описан в
 * `lib/supabase/candidates.types.ts`.
 */

export type BadgeColor = "blue" | "amber" | "violet" | "teal" | "green" | "red" | "gray";

/** Раздел портала. Матрица прав по разделам — `lib/auth/roles.ts`. */
export type PortalPage =
  | "overview"
  | "demand"
  | "addresses"
  | "candidates"
  | "vacancies"
  | "rates"
  | "marketing"
  | "analytics"
  | "notifications"
  | "settings";

export type ToastType = "success" | "error";

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
}
