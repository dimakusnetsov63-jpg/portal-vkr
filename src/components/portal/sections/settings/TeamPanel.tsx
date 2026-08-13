"use client";

import { useCallback, useEffect, useState } from "react";
import { usePortal } from "@/components/portal/context/PortalContext";
import { Badge } from "@/components/portal/ui/Badge";
import { Button } from "@/components/portal/ui/Button";
import { Icon } from "@/components/portal/ui/Icon";
import { Panel, PanelBody, PanelHead } from "@/components/portal/ui/Panel";
import { SkeletonLines } from "@/components/portal/ui/StateViews";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { avatarColor, initials } from "@/lib/portal/format";
import { activeListOptions } from "@/lib/portal/candidateOptions";
import {
  createPortalUser,
  listPortalUsers,
  setPortalUserActive,
  setPortalUserPassword,
  setPortalUserProjects,
  updatePortalUser,
} from "@/lib/supabase/portalUsersRepo";
import type { PortalUser } from "@/lib/supabase/portalAuth.types";
import { UserFormModal, type UserFormSubmit } from "./UserFormModal";
import primitives from "@/components/portal/ui/primitives.module.css";
import styles from "./SettingsSection.module.css";

/**
 * Команда и роли: список учётных записей, создание, редактирование и
 * переключатель доступа.
 *
 * Список грузится здесь, а не в `PortalContext`: он нужен ровно в одной
 * панели и только руководителю — класть его в глобальный стор значит
 * запрашивать данные, которые у остальных ролей всё равно закончатся
 * отказом (тот же случай, что и с историей в `DemandHistoryDrawer`).
 *
 * Пароля здесь нет ни в каком виде: его нельзя показать, потому что портал
 * его не знает. Доступны только «задать новый» — в форме редактирования.
 */

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function TeamPanel() {
  const { pushToast, currentUser, listOptions } = usePortal();

  const [users, setUsers] = useState<PortalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PortalUser | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Полный список проектов справочника — нужен только для обходного пути
  // создания учётки с «Всеми проектами» (см. handleSubmit).
  const allProjectOptions = activeListOptions(listOptions, "project").map((o) => o.value);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setUsers(await listPortalUsers());
    } catch (e) {
      setLoadError(errorMessage(e, "Не удалось загрузить пользователей"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- начальная загрузка списка
    refresh();
  }, [refresh]);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(user: PortalUser) {
    setEditing(user);
    setFormOpen(true);
  }

  async function handleSubmit(values: UserFormSubmit): Promise<string | null> {
    try {
      if (!editing) {
        // portal_admin_create_user требует непустой список проектов и про
        // all_projects не знает вовсе. Поэтому при «Все проекты» создаём с
        // текущим полным списком (на этот момент он и означает «все»), а
        // сразу следом переводим учётку на флаг — тогда ей достанутся и
        // проекты, которые заведут позже.
        const created = await createPortalUser({
          full_name: values.fullName,
          login: values.login,
          password: values.password,
          role: values.role,
          projects: values.allProjects && values.projects.length === 0 ? allProjectOptions : values.projects,
          is_active: values.isActive,
        });
        const withProjects = values.allProjects
          ? await setPortalUserProjects(created.id, { projects: [], all_projects: true })
          : created;
        setUsers((prev) => [...prev, withProjects]);
        pushToast("Пользователь создан");
        return null;
      }

      // Проекты сохраняются первыми: portal_admin_update_user разрешает
      // пустой список только у учётки, у которой all_projects уже поднят.
      // В обратном порядке включение «Всех проектов» с очисткой списка
      // упиралось бы в её проверку.
      let saved = await setPortalUserProjects(editing.id, {
        projects: values.allProjects ? [] : values.projects,
        all_projects: values.allProjects,
      });
      saved = await updatePortalUser(editing.id, {
        full_name: values.fullName,
        role: values.role,
        projects: values.allProjects ? [] : values.projects,
      });
      // Пустой пароль в форме означает «не менять» — лишний вызов закрыл бы
      // пользователю все сессии без причины.
      if (values.password) {
        saved = await setPortalUserPassword(editing.id, values.password);
      }
      if (values.isActive !== editing.is_active) {
        saved = await setPortalUserActive(editing.id, values.isActive);
      }
      setUsers((prev) => prev.map((u) => (u.id === saved.id ? saved : u)));
      pushToast(values.password ? "Изменения сохранены, пароль обновлён" : "Изменения сохранены");
      return null;
    } catch (e) {
      return errorMessage(e, "Не удалось сохранить пользователя");
    }
  }

  async function handleToggleActive(user: PortalUser) {
    setTogglingId(user.id);
    try {
      const saved = await setPortalUserActive(user.id, !user.is_active);
      setUsers((prev) => prev.map((u) => (u.id === saved.id ? saved : u)));
      pushToast(saved.is_active ? "Доступ включён" : "Доступ отключён, сессии завершены");
    } catch (e) {
      pushToast(errorMessage(e, "Не удалось изменить доступ"), "error");
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <Panel>
      <PanelHead>
        <h3>Команда и роли</h3>
        <div className={styles.headActionSlot}>
          <Button size="sm" onClick={openCreate}>
            <Icon name="plus" size={14} />
            Создать пользователя
          </Button>
        </div>
      </PanelHead>
      <PanelBody>
        {loading && <SkeletonLines lines={4} />}

        {!loading && loadError && (
          <p className={styles.fieldError}>
            {loadError}{" "}
            <button
              onClick={refresh}
              style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
            >
              Повторить
            </button>
          </p>
        )}

        {!loading && !loadError && users.length === 0 && <p className={styles.fieldNote}>Пользователей пока нет.</p>}

        {!loading &&
          !loadError &&
          users.map((user) => (
            <div
              className={`${styles.teamRow} ${user.is_active ? "" : styles.teamRowInactive}`}
              key={user.id}
            >
              <div className={styles.teamAvatar} style={{ background: avatarColor(user.full_name) }}>
                {initials(user.full_name)}
              </div>
              <div className={styles.txt}>
                <div className={styles.teamName}>
                  <b>{user.full_name}</b>
                  <span className={styles.teamLogin}>@{user.login}</span>
                  <Badge color={user.is_active ? "green" : "gray"}>
                    {user.is_active ? "Активен" : "Отключён"}
                  </Badge>
                </div>
                <span
                  className={styles.teamProjects}
                  title={user.all_projects ? "Все проекты, включая будущие" : user.projects.join(", ")}
                >
                  {ROLE_LABELS[user.role]} ·{" "}
                  {user.all_projects ? "все проекты" : user.projects.join(", ") || "проекты не выбраны"}
                </span>
              </div>
              <div className={styles.teamControls}>
                <button
                  className={`${primitives.btnIcon} ${primitives.btnIconSm}`}
                  onClick={() => openEdit(user)}
                  aria-label={`Изменить ${user.full_name}`}
                  title="Изменить"
                >
                  <Icon name="pencil" size={16} />
                </button>
                <button
                  className={`${primitives.toggle} ${user.is_active ? primitives.toggleOn : ""}`}
                  onClick={() => handleToggleActive(user)}
                  disabled={togglingId === user.id || user.id === currentUser.id}
                  aria-label={user.is_active ? "Отключить доступ" : "Включить доступ"}
                  title={
                    user.id === currentUser.id
                      ? "Нельзя отключить собственную учётную запись"
                      : user.is_active
                        ? "Активен — вход разрешён"
                        : "Отключён — вход запрещён"
                  }
                />
              </div>
            </div>
          ))}
      </PanelBody>

      <UserFormModal open={formOpen} user={editing} onClose={() => setFormOpen(false)} onSubmit={handleSubmit} />
    </Panel>
  );
}
