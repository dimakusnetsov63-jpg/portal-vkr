import type { PortalRole } from "@/lib/auth/roles";

/**
 * Типы таблиц и функций встроенной авторизации портала.
 *
 * Написаны руками — в отличие от остальных `*.types.ts`, которые выводятся из
 * генерируемого `database.types.ts`. Причина: миграция `20260728120000_portal_auth.sql`
 * ещё не отражена в сгенерированных типах, а регенерация требует доступа к
 * боевой базе (`npx supabase gen types typescript --linked`). После неё этот
 * файл можно свести к выводу из `Database`, как сделано в соседних модулях.
 *
 * Таблиц здесь нет намеренно: `portal_users` / `portal_sessions` /
 * `portal_audit_log` закрыты RLS полностью и доступны только через RPC.
 */

/**
 * Права роли на один раздел. Приходят с сервера из
 * `portal_section_permissions` — той же таблицы, на которую смотрит RLS.
 *
 * `visible` — только UX: скрытый пункт меню не является защитой, прямой
 * заход по URL обязан упереться в `can_view` (middleware) и в политики RLS.
 */
export interface SectionPermission {
  visible: boolean;
  can_view: boolean;
  can_edit: boolean;
}

/**
 * Матрица прав роли: ключ — раздел (`PortalPermission`), значение — три
 * флага. Ключи присутствуют для **всех** разделов, включая недоступные (у
 * них все три `false`), поэтому отсутствие ключа означает не «нет права», а
 * рассинхронизацию с `portal_section_order()`.
 */
export type SectionPermissions = Record<string, SectionPermission>;

export interface PortalUser {
  id: string;
  full_name: string;
  login: string;
  role: PortalRole;
  projects: string[];
  /** `true` — доступны все проекты, включая будущие; `projects` игнорируется. */
  all_projects: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  /** Матрица прав роли. Источник истины — база, а не `roles.ts`. */
  permissions: SectionPermissions;
}

/** Почему вход не удался. `disabled` — учётка отключена администратором. */
export type PortalLoginFailure = "invalid_credentials" | "disabled" | "throttled";

export type PortalLoginResult =
  | { ok: true; token: string; session_id: string; expires_at: string; user: PortalUser }
  /**
   * `retry_after` — секунды до следующей разрешённой попытки. Приходит только
   * с `reason: "throttled"`: окно растёт экспоненциально с каждой неудачей
   * (см. миграцию `20260801100000_login_rate_limit.sql`), поэтому фиксированной
   * подписи «попробуйте через 15 минут» больше недостаточно — она была бы
   * неправдой в большинстве случаев.
   */
  | { ok: false; reason: PortalLoginFailure; retry_after?: number };

export type PortalSessionResult =
  | { ok: true; session_id: string; user: PortalUser }
  | { ok: false; reason: "no_session" | "disabled" };

export type PortalAuditAction =
  | "user_created"
  | "user_updated"
  | "user_role_changed"
  | "user_password_changed"
  | "user_activated"
  | "user_deactivated"
  | "login_success"
  | "login_failed"
  | "logout"
  | "section_permission_changed"
  | "user_projects_changed"
  // TASK-013, C5: раздел «Контроль качества» пишет в тот же журнал.
  // Цели-пользователя у этих событий нет — опознавательные поля (лид,
  // сотрудник, проект) и разница «было → стало» лежат в `details`.
  | "quality_review_created"
  | "quality_review_updated";

export interface PortalAuditEntry {
  id: string;
  action: PortalAuditAction;
  actor_login: string | null;
  target_login: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface NewPortalUserInput {
  full_name: string;
  login: string;
  password: string;
  role: PortalRole;
  projects: string[];
  is_active: boolean;
}

export interface PortalUserPatch {
  full_name: string;
  role: PortalRole;
  projects: string[];
}

/** Строка матрицы прав в ответе `portal_admin_list_section_permissions`. */
export interface SectionPermissionRow {
  role: PortalRole;
  section: string;
  visible: boolean;
  can_view: boolean;
  can_edit: boolean;
  updated_at: string;
}

/** Что меняет `portal_admin_set_user_projects`: список и признак «все проекты». */
export interface PortalUserProjectsPatch {
  projects: string[];
  all_projects: boolean;
}

/** Схема для типизированного клиента Supabase: только RPC, без таблиц. */
export type PortalAuthDatabase = {
  public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      portal_login: {
        // `p_ip` необязателен, потому что у параметра есть значение по
        // умолчанию в SQL. Обязательность обеспечивается уровнем выше — в
        // `lib/auth/session.ts` аргумент `ip` требуется явно.
        Args: { p_login: string; p_password: string; p_user_agent?: string | null; p_ip?: string | null };
        Returns: PortalLoginResult;
      };
      portal_session_context: {
        Args: { p_token: string };
        Returns: PortalSessionResult;
      };
      portal_logout: {
        Args: { p_token: string };
        Returns: undefined;
      };
      portal_admin_list_users: {
        Args: never;
        Returns: PortalUser[];
      };
      portal_admin_login_available: {
        Args: { p_login: string };
        Returns: boolean;
      };
      portal_admin_create_user: {
        Args: {
          p_full_name: string;
          p_login: string;
          p_password: string;
          p_role: PortalRole;
          p_projects: string[];
          p_is_active?: boolean;
        };
        Returns: PortalUser;
      };
      portal_admin_update_user: {
        Args: { p_user_id: string; p_full_name: string; p_role: PortalRole; p_projects: string[] };
        Returns: PortalUser;
      };
      portal_admin_set_user_active: {
        Args: { p_user_id: string; p_is_active: boolean };
        Returns: PortalUser;
      };
      portal_admin_set_password: {
        Args: { p_user_id: string; p_password: string };
        Returns: PortalUser;
      };
      portal_admin_list_audit: {
        Args: { p_limit?: number };
        Returns: PortalAuditEntry[];
      };
      portal_admin_list_section_permissions: {
        Args: never;
        Returns: SectionPermissionRow[];
      };
      portal_admin_set_section_permission: {
        Args: {
          p_role: PortalRole;
          p_section: string;
          p_visible: boolean;
          p_can_view: boolean;
          p_can_edit: boolean;
        };
        Returns: SectionPermissionRow;
      };
      portal_admin_set_user_projects: {
        Args: { p_user_id: string; p_projects: string[]; p_all_projects: boolean };
        Returns: PortalUser;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
