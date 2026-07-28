import type { PortalRole } from "@/lib/auth/roles";

/**
 * Проверки формы учётной записи. Чистая логика без React и Supabase.
 *
 * Те же правила продублированы в базе (`portal_admin_create_user`,
 * `portal_assert_password`, CHECK-ограничения `portal_users`): проверка
 * здесь — удобство, настоящая защита — там. Уникальность логина проверить
 * локально нельзя: за ней ходят в базу отдельно.
 */

export const LOGIN_PATTERN = /^[a-z0-9._-]{3,32}$/;
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
  isActive: boolean;
}

export type UserFormErrors = Partial<Record<"fullName" | "login" | "password" | "confirmPassword" | "projects", string>>;

/** Нормализация логина: он хранится только в нижнем регистре без пробелов по краям. */
export function normalizeLogin(login: string): string {
  return login.trim().toLowerCase();
}

export function validateUserForm(values: UserFormValues, mode: UserFormMode): UserFormErrors {
  const errors: UserFormErrors = {};

  if (values.fullName.trim().length < MIN_FULL_NAME_LENGTH) {
    errors.fullName = "Укажите ФИО";
  }

  // Логин задаётся один раз: при редактировании поле не показывается,
  // потому что смена логина обесценивает записи журнала.
  if (mode === "create" && !LOGIN_PATTERN.test(normalizeLogin(values.login))) {
    errors.login = "3–32 символа: латиница в нижнем регистре, цифры, точка, дефис, подчёркивание";
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

  if (values.projects.length === 0) {
    errors.projects = "Выберите хотя бы один проект";
  }

  return errors;
}

export function hasErrors(errors: UserFormErrors): boolean {
  return Object.keys(errors).length > 0;
}
