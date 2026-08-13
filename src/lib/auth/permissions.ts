import type { PortalPage } from "@/lib/portal/types";
import type { SectionPermission, SectionPermissions } from "@/lib/supabase/portalAuth.types";

/**
 * Чтение матрицы прав, пришедшей с сервера.
 *
 * Права больше не вычисляются на клиенте: `portal_user_json()` отдаёт их
 * вместе с пользователем, из той же таблицы `portal_section_permissions`,
 * на которую смотрит RLS. Здесь только чтение готового ответа — ни одного
 * решения вида «роль такая-то, значит можно».
 *
 * Три уровня различаются намеренно и не взаимозаменяемы:
 *
 *   visible  — показывать пункт в меню. **Не механизм безопасности.**
 *              Скрытый раздел обязан оставаться открываемым по прямой
 *              ссылке, если `can_view` при этом есть.
 *   can_view — открыть раздел и читать данные. По нему решают middleware
 *              (403 на `?section=`) и `select`-политики RLS.
 *   can_edit — изменять данные. По нему решают кнопки записи и
 *              `insert`/`update`/`delete`-политики.
 *
 * Инвариант `can_edit => can_view => visible` гарантирован
 * CHECK-ограничениями таблицы, поэтому проверять «can_edit и заодно
 * can_view» не нужно нигде.
 */

/** Право отсутствует: раздела нет в матрице (рассинхронизация с `portal_section_order()`). */
const NONE: SectionPermission = { visible: false, can_view: false, can_edit: false };

function permissionFor(permissions: SectionPermissions | undefined, section: string): SectionPermission {
  return permissions?.[section] ?? NONE;
}

/** Показывать ли раздел в меню. Только UX — доступ этим не решается. */
export function isSectionVisible(permissions: SectionPermissions | undefined, section: string): boolean {
  return permissionFor(permissions, section).visible;
}

/** Может ли пользователь открыть раздел и читать данные. */
export function canViewSection(permissions: SectionPermissions | undefined, section: string): boolean {
  return permissionFor(permissions, section).can_view;
}

/** Может ли пользователь изменять данные раздела. */
export function canEditSection(permissions: SectionPermissions | undefined, section: string): boolean {
  return permissionFor(permissions, section).can_edit;
}

/**
 * Разделы для меню — в порядке, заданном вызывающим (`NAV_ITEMS`), и только
 * помеченные `visible`.
 */
export function visibleSections(
  permissions: SectionPermissions | undefined,
  order: readonly PortalPage[],
): PortalPage[] {
  return order.filter((section) => isSectionVisible(permissions, section));
}

/**
 * Стартовый раздел: первый в порядке меню, который пользователь может
 * **открыть**. Именно `can_view`, а не `visible` — иначе пользователь
 * приземлялся бы на разделе, скрытом из навигации, и не понимал, где он.
 *
 * `undefined` — доступных разделов нет вовсе. Такое состояние законно
 * (администратор может отобрать у роли всё) и обрабатывается вызывающим:
 * показывать пустой портал честнее, чем бросать пользователя на страницу,
 * которую ему всё равно не откроют.
 */
export function firstViewableSection(
  permissions: SectionPermissions | undefined,
  order: readonly PortalPage[],
): PortalPage | undefined {
  return order.find((section) => canViewSection(permissions, section));
}

/**
 * Приведение переключателей к валидному состоянию (§11 ТЗ): выключение
 * «Просмотра» гасит «Редактирование», выключение «Показывать» гасит оба.
 *
 * Дубль CHECK-ограничения в базе — намеренный. База не даст сохранить
 * невалидное сочетание, но интерфейс не должен позволять его даже собрать:
 * иначе пользователь снимает галочку и получает ошибку вместо ожидаемого
 * результата.
 */
export function normalizePermission(next: SectionPermission): SectionPermission {
  const visible = next.visible;
  const canView = visible && next.can_view;
  const canEdit = canView && next.can_edit;
  return { visible, can_view: canView, can_edit: canEdit };
}
