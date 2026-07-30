"use client";

import { useCallback, useEffect, useState } from "react";
import { Panel, PanelBody, PanelHead } from "@/components/portal/ui/Panel";
import { SkeletonLines } from "@/components/portal/ui/StateViews";
import { listPortalAudit } from "@/lib/supabase/portalUsersRepo";
import type { PortalAuditAction, PortalAuditEntry } from "@/lib/supabase/portalAuth.types";
import styles from "./SettingsSection.module.css";

/**
 * Журнал действий администратора и входов.
 *
 * Читается из `portal_audit_log`: записи туда делают только SECURITY DEFINER
 * функции, приложение не может ни вставить, ни изменить, ни удалить их.
 * Паролей в журнале нет — фиксируется только факт смены.
 */

const AUDIT_LIMIT = 50;

const ACTION_LABELS: Record<PortalAuditAction, string> = {
  user_created: "создал пользователя",
  user_updated: "изменил пользователя",
  user_role_changed: "сменил роль",
  user_password_changed: "изменил пароль",
  user_activated: "включил доступ",
  user_deactivated: "отключил доступ",
  login_success: "вошёл в портал",
  login_failed: "неудачная попытка входа",
  logout: "вышел из портала",
};

function formatMoment(iso: string): string {
  const date = new Date(iso);
  return `${date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })}, ${date.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function describe(entry: PortalAuditEntry): string {
  const actor = entry.actor_login ? `@${entry.actor_login}` : "Система";
  const action = ACTION_LABELS[entry.action];

  if (entry.action === "login_failed") {
    const login = entry.target_login ? `@${entry.target_login}` : "неизвестный логин";
    const reason = entry.details.reason === "disabled" ? " (учётная запись отключена)" : "";
    return `${action}: ${login}${reason}`;
  }
  if (entry.action === "login_success" || entry.action === "logout") {
    return `${actor} ${action}`;
  }
  if (entry.action === "user_role_changed") {
    return `${actor} ${action} @${entry.target_login}: ${entry.details.from} → ${entry.details.to}`;
  }
  return `${actor} ${action} @${entry.target_login ?? "—"}`;
}

export function AuditLogPanel() {
  const [entries, setEntries] = useState<PortalAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEntries(await listPortalAudit(AUDIT_LIMIT));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить журнал");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- начальная загрузка журнала
    refresh();
  }, [refresh]);

  return (
    <Panel>
      <PanelHead>
        <h3>Журнал действий</h3>
        <span className={styles.fieldNote}>Последние {AUDIT_LIMIT}</span>
      </PanelHead>
      <PanelBody>
        {loading && <SkeletonLines lines={4} />}
        {!loading && error && <p className={styles.fieldError}>{error}</p>}
        {!loading && !error && entries.length === 0 && <p className={styles.fieldNote}>Записей пока нет.</p>}
        {!loading &&
          !error &&
          entries.map((entry) => (
            <div className={styles.auditRow} key={entry.id}>
              <span className={styles.auditText}>{describe(entry)}</span>
              <span className={styles.auditTime}>{formatMoment(entry.created_at)}</span>
            </div>
          ))}
      </PanelBody>
    </Panel>
  );
}
