import type { PortalRole } from "@/lib/auth/roles";

/**
 * Проверки формы учётной записи. Чистая логика без React и Supabase.
 *
 * Те же правила продублированы в базе (`portal_admin_create_user`,
 * `portal_assert_password`, CHECK-ограничения `portal_users`): проверка
 * здесь — удобство, настоящая защита — там. Уникальность логина проверить
 * локально нельзя: за ней ходят в базу отдельно.
 */

/**
 * Логин — либо короткое имя (`ivanov`), либо рабочая почта
 * (`hr39@outsourcing-kadrov.ru`): в компании учётки заводят по почте.
 * Домен необязателен, длина проверяется отдельно — в самом выражении
 * ограничить общую длину вместе с необязательной доменной частью нельзя.
 */
export const LOGIN_PATTERN = /^[a-z0-9._+-]{1,64}(@[a-z0-9-]+(\.[a-z0-9-]+)+)?$/;
export const MIN_LOGIN_LENGTH = 3;
export const MAX_LOGIN_LENGTH = 100;
export const MIN_PASSWORD_LENGTH = 8;
export const MIN_FULL_NAME_LENGTH = 2;

export type UserFormMode = "create" | "edit";

export interface UserFormValues {
  fullName: string;
  login: string;
  password: string;
  confirmPassword: string;
  role: PortalRole;
  projects: string[];
  /**
   * Доступ ко всем проектам, включая те, что появятся позже. При `true`
   * список `projects` не используется — ни интерфейсом, ни
   * `portal_has_project()` в базе.
   */
  allProjects: boolean;
  isActive: boolean;
}

export type UserFormErrors = Partial<Record<"fullName" | "login" | "password" | "confirmPassword" | "projects", string>>;

/** Нормализация логина: он хранится только в нижнем регистре без пробелов по краям. */
export function normalizeLogin(login: string): string {
  return login.trim().toLowerCase();
}

/** Допустим ли логин: те же правила, что в CHECK-ограничении `portal_users`. */
export function isValidLogin(login: string): boolean {
  const normalized = normalizeLogin(login);
  return (
    normalized.length >= MIN_LOGIN_LENGTH &&
    normalized.length <= MAX_LOGIN_LENGTH &&
    LOGIN_PATTERN.test(normalized)
  );
}

export function validateUserForm(values: UserFormValues, mode: UserFormMode): UserFormErrors {
  const errors: UserFormErrors = {};

  if (values.fullName.trim().length < MIN_FULL_NAME_LENGTH) {
    errors.fullName = "Укажите ФИО";
  }

  // Логин задаётся один раз: при редактировании поле не показывается,
  // потому что смена логина обесценивает записи журнала.
  if (mode === "create" && !isValidLogin(values.login)) {
    errors.login = "3–100 символов: латиница в нижнем регистре, цифры, точка, дефис, подчёркивание, плюс; либо рабочая почта";
  }

  // При редактировании пустой пароль означает «не менять».
  const passwordRequired = mode === "create" || values.password.length > 0 || values.confirmPassword.length > 0;
  if (passwordRequired) {
    if (values.password.length < MIN_PASSWORD_LENGTH) {
      errors.password = `Не короче ${MIN_PASSWORD_LENGTH} символов`;
    } else if (values.password !== values.confirmPassword) {
      errors.confirmPassword = "Пароли не совпадают";
    }
  }

  // Пустой список допустим только вместе с «Все проекты» — ровно то же
  // условие, что стоит CHECK-ограничением на portal_users
  // (`all_projects or cardinality(projects) > 0`). Учётка без проектов и
  // без флага не увидела бы ни строки ни в одном проектном разделе.
  if (!values.allProjects && values.projects.length === 0) {
    errors.projects = "Выберите хотя бы один проект или включите «Все проекты»";
  }

  return errors;
}

export function hasErrors(errors: UserFormErrors): boolean {
  return Object.keys(errors).length > 0;
}
