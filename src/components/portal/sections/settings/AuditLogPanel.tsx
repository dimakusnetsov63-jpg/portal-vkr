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
  section_permission_changed: "изменил права роли",
  user_projects_changed: "изменил проекты пользователя",
  quality_review_created: "создал проверку качества",
  quality_review_updated: "изменил проверку качества",
};

/** Одна строка разницы по пункту чек-листа в записи журнала. */
interface QualityScoreChange {
  item: string;
  from: string;
  to: string;
}

/**
 * Событие раздела «Контроль качества» описывается не через `target_login` —
 * цели-пользователя у него нет, — а через опознавательные поля в `details`:
 * лид, сотрудник, проект. У правки дополнительно показывается, что именно
 * изменилось: переход статуса, сдвиг итога и первые изменённые пункты.
 * Полный список остаётся в `details` — панель не должна разрастаться до
 * тридцати пяти строк на одну запись.
 */
function describeQualityReview(entry: PortalAuditEntry, actor: string, action: string): string {
  const lead = entry.details.crm_lead_id;
  const employee = typeof entry.details.employee_name === "string" ? entry.details.employee_name : "—";
  const head = `${actor} ${action}: лид ${lead ?? "—"}, ${employee}`;

  const parts: string[] = [];

  const status = entry.details.status as { from?: string; to?: string } | undefined;
  if (status?.from && status.to) {
    parts.push(`статус ${STATUS_TEXT[status.from] ?? status.from} → ${STATUS_TEXT[status.to] ?? status.to}`);
  }

  const total = entry.details.total_score as { from?: number | null; to?: number | null } | undefined;
  if (total && "from" in total) {
    parts.push(`итог ${formatScore(total.from)} → ${formatScore(total.to)}`);
  }

  const scores = Array.isArray(entry.details.scores) ? (entry.details.scores as QualityScoreChange[]) : [];
  if (scores.length > 0) {
    const shown = scores
      .slice(0, 3)
      .map((change) => `«${change.item}» ${change.from} → ${change.to}`)
      .join("; ");
    parts.push(scores.length > 3 ? `${shown} и ещё ${scores.length - 3}` : shown);
  }

  return parts.length > 0 ? `${head} — ${parts.join("; ")}` : head;
}

const STATUS_TEXT: Record<string, string> = {
  draft: "черновик",
  completed: "завершена",
};

function formatScore(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : `${value}%`;
}

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
  if (entry.action === "quality_review_created" || entry.action === "quality_review_updated") {
    return describeQualityReview(entry, actor, action);
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
