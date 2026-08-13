"use client";

import { useCallback, useEffect, useState } from "react";
import { usePortal } from "@/components/portal/context/PortalContext";
import { Panel, PanelBody, PanelHead } from "@/components/portal/ui/Panel";
import { SkeletonLines } from "@/components/portal/ui/StateViews";
import { PORTAL_ROLES, ROLE_LABELS, type PortalRole } from "@/lib/auth/roles";
import { normalizePermission } from "@/lib/auth/permissions";
import { listSectionPermissions, setSectionPermission } from "@/lib/supabase/portalUsersRepo";
import type { SectionPermission, SectionPermissionRow } from "@/lib/supabase/portalAuth.types";
import { SECTION_LABELS, isLockedCell, sectionsInMenuOrder, toMatrix, type PermissionMatrix } from "./accessMatrix";
import styles from "./SettingsSection.module.css";

/**
 * «Настройки → Доступы»: матрица «раздел × роль» с тремя переключателями.
 *
 * Панель — единственный штатный способ менять права. Сохранение идёт через
 * `portal_admin_set_section_permission`, которая сама проверяет роль
 * вызывающего и пишет в журнал «было → стало»; интерфейс скрывает и
 * подсказывает, но ничего не решает.
 *
 * Инвариант `can_edit => can_view => visible` соблюдается тут же, до
 * запроса (`normalizePermission`): снятие «Просмотра» гасит
 * «Редактирование», снятие «Показывать» гасит оба. Дубль CHECK-ограничения
 * намеренный — иначе пользователь снимал бы галочку и получал ошибку
 * вместо ожидаемого результата.
 */

const FLAGS = [
  { key: "visible", label: "Показывать", hint: "Пункт в меню. Не защита: раздел с правом просмотра открывается по прямой ссылке." },
  { key: "can_view", label: "Просмотр", hint: "Открыть раздел и читать данные." },
  { key: "can_edit", label: "Редактирование", hint: "Изменять данные раздела." },
] as const;

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function AccessPanel() {
  const { pushToast, currentUser, applyOwnSectionPermission } = usePortal();

  const [matrix, setMatrix] = useState<PermissionMatrix>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingCell, setSavingCell] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setMatrix(toMatrix(await listSectionPermissions()));
    } catch (e) {
      setLoadError(errorMessage(e, "Не удалось загрузить права"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- начальная загрузка матрицы
    refresh();
  }, [refresh]);

  async function toggle(role: PortalRole, section: string, flag: (typeof FLAGS)[number]["key"]) {
    const current = matrix[role]?.[section];
    if (!current) return;

    const next = normalizePermission({ ...current, [flag]: !current[flag] });
    const cellKey = `${role}:${section}`;
    setSavingCell(cellKey);

    // Оптимистично: переключатель откликается сразу, а при отказе сервера
    // состояние возвращается перечитыванием — так пользователь не видит
    // «залипшую» галочку, которой на самом деле нет в базе.
    setMatrix((prev) => ({ ...prev, [role]: { ...prev[role], [section]: next } }));

    try {
      const saved: SectionPermissionRow = await setSectionPermission(role, section, next);
      const applied: SectionPermission = {
        visible: saved.visible,
        can_view: saved.can_view,
        can_edit: saved.can_edit,
      };
      setMatrix((prev) => ({ ...prev, [role]: { ...prev[role], [section]: applied } }));

      // Своя роль — обновляем права текущей сессии сразу, иначе
      // администратор не увидит эффекта до перезагрузки страницы и решит,
      // что сохранение не сработало. Остальным права достанутся при их
      // следующей загрузке страницы.
      if (role === currentUser.role) applyOwnSectionPermission(section, applied);
    } catch (e) {
      pushToast(errorMessage(e, "Не удалось сохранить право"), "error");
      await refresh();
    } finally {
      setSavingCell(null);
    }
  }

  return (
    <Panel>
      <PanelHead>
        <div>
          <b>Доступы</b>
          <div className={styles.panelHint}>
            Какие разделы видит и может править каждая роль. Изменения действуют сразу: интерфейс и база читают одну и
            ту же матрицу. Другим пользователям новые права достанутся при следующей загрузке страницы.
          </div>
        </div>
      </PanelHead>
      <PanelBody>
        {loading && <SkeletonLines lines={8} />}
        {!loading && loadError && <div className={styles.panelError}>{loadError}</div>}
        {!loading && !loadError && (
          <div className={styles.accessScroll}>
            <table className={styles.accessTable}>
              <thead>
                <tr>
                  <th scope="col">Раздел</th>
                  {PORTAL_ROLES.map((role) => (
                    <th key={role} scope="col">
                      {ROLE_LABELS[role]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sectionsInMenuOrder(matrix).map((section) => (
                  <tr key={section}>
                    <th scope="row">{SECTION_LABELS[section] ?? section}</th>
                    {PORTAL_ROLES.map((role) => {
                      const cell = matrix[role]?.[section];
                      const locked = isLockedCell(role, section);
                      const busy = savingCell === `${role}:${section}`;
                      return (
                        <td key={role} className={locked ? styles.accessCellLocked : undefined}>
                          {cell &&
                            FLAGS.map((flag) => (
                              <label
                                key={flag.key}
                                className={styles.accessFlag}
                                title={
                                  locked
                                    ? "Руководителю нельзя закрыть этот раздел — иначе управление доступами станет недостижимым"
                                    : flag.hint
                                }
                              >
                                <input
                                  type="checkbox"
                                  checked={cell[flag.key]}
                                  disabled={locked || busy}
                                  onChange={() => void toggle(role, section, flag.key)}
                                />
                                <span>{flag.label}</span>
                              </label>
                            ))}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}
