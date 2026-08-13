import { createPortalAuthClient } from "./client";
import type { PortalRole } from "@/lib/auth/roles";
import type {
  NewPortalUserInput,
  PortalAuditEntry,
  PortalUser,
  PortalUserPatch,
  PortalUserProjectsPatch,
  SectionPermissionRow,
} from "./portalAuth.types";

/**
 * Управление учётными записями портала.
 *
 * Работает не с таблицей, а с набором `SECURITY DEFINER` функций: сами
 * `portal_users` закрыты RLS полностью. Право «руководитель» проверяется
 * внутри каждой функции по `auth.uid()` из подписанного порталом JWT —
 * подделать вызов, отправив запрос мимо интерфейса, нельзя.
 *
 * Пароль передаётся только в одну сторону. Ни одна функция не возвращает
 * `password_hash`, и открытого пароля в базе не существует.
 */

export async function listPortalUsers(): Promise<PortalUser[]> {
  const supabase = createPortalAuthClient();
  const { data, error } = await supabase.rpc("portal_admin_list_users");
  if (error) throw error;
  return data;
}

/** Свободен ли логин. Вызывается во время ввода, поэтому ошибку наверх не бросает. */
export async function isPortalLoginAvailable(login: string): Promise<boolean> {
  const supabase = createPortalAuthClient();
  const { data, error } = await supabase.rpc("portal_admin_login_available", { p_login: login });
  if (error) throw error;
  return data;
}

export async function createPortalUser(input: NewPortalUserInput): Promise<PortalUser> {
  const supabase = createPortalAuthClient();
  const { data, error } = await supabase.rpc("portal_admin_create_user", {
    p_full_name: input.full_name,
    p_login: input.login,
    p_password: input.password,
    p_role: input.role,
    p_projects: input.projects,
    p_is_active: input.is_active,
  });
  if (error) throw error;
  return data;
}

export async function updatePortalUser(id: string, patch: PortalUserPatch): Promise<PortalUser> {
  const supabase = createPortalAuthClient();
  const { data, error } = await supabase.rpc("portal_admin_update_user", {
    p_user_id: id,
    p_full_name: patch.full_name,
    p_role: patch.role,
    p_projects: patch.projects,
  });
  if (error) throw error;
  return data;
}

/** Деактивация закрывает все открытые сессии пользователя — это делает сама функция в базе. */
export async function setPortalUserActive(id: string, isActive: boolean): Promise<PortalUser> {
  const supabase = createPortalAuthClient();
  const { data, error } = await supabase.rpc("portal_admin_set_user_active", {
    p_user_id: id,
    p_is_active: isActive,
  });
  if (error) throw error;
  return data;
}

export async function setPortalUserPassword(id: string, password: string): Promise<PortalUser> {
  const supabase = createPortalAuthClient();
  const { data, error } = await supabase.rpc("portal_admin_set_password", {
    p_user_id: id,
    p_password: password,
  });
  if (error) throw error;
  return data;
}

/**
 * Проекты пользователя — отдельно от `updatePortalUser`: у той пришлось бы
 * менять сигнатуру RPC вместе с грантами. Здесь ровно один орган
 * управления — список проектов и чекбокс «Все проекты».
 *
 * Пустой список допустим только вместе с `all_projects: true`; иначе база
 * ответит `22023` — учётка без проектов не увидит ни строки ни в одном
 * проектном разделе.
 */
export async function setPortalUserProjects(
  id: string,
  patch: PortalUserProjectsPatch,
): Promise<PortalUser> {
  const supabase = createPortalAuthClient();
  const { data, error } = await supabase.rpc("portal_admin_set_user_projects", {
    p_user_id: id,
    p_projects: patch.projects,
    p_all_projects: patch.all_projects,
  });
  if (error) throw error;
  return data;
}

/** Матрица прав целиком — для раздела «Настройки → Доступы». */
export async function listSectionPermissions(): Promise<SectionPermissionRow[]> {
  const supabase = createPortalAuthClient();
  const { data, error } = await supabase.rpc("portal_admin_list_section_permissions");
  if (error) throw error;
  return data;
}

/**
 * Одна ячейка матрицы. Инвариант `can_edit => can_view => visible`
 * проверяет база: она же вернёт внятную ошибку, если интерфейс пропустит
 * невалидное сочетание. У роли `head` разделы `settings` и `users`
 * отключить нельзя — иначе управление доступами станет недостижимым.
 */
export async function setSectionPermission(
  role: PortalRole,
  section: string,
  flags: { visible: boolean; can_view: boolean; can_edit: boolean },
): Promise<SectionPermissionRow> {
  const supabase = createPortalAuthClient();
  const { data, error } = await supabase.rpc("portal_admin_set_section_permission", {
    p_role: role,
    p_section: section,
    p_visible: flags.visible,
    p_can_view: flags.can_view,
    p_can_edit: flags.can_edit,
  });
  if (error) throw error;
  return data;
}

export async function listPortalAudit(limit = 50): Promise<PortalAuditEntry[]> {
  const supabase = createPortalAuthClient();
  const { data, error } = await supabase.rpc("portal_admin_list_audit", { p_limit: limit });
  if (error) throw error;
  return data;
}

// Функции удаления пользователя нет намеренно: учётки не удаляются, только
// деактивируются — иначе журнал действий терял бы автора.
