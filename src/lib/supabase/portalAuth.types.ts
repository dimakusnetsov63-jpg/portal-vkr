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

export interface PortalUser {
  id: string;
  full_name: string;
  login: string;
  role: PortalRole;
  projects: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
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
  | "logout";

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
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
