"use client";

import { useCallback, useEffect, useState } from "react";
import { Panel, PanelBody, PanelHead } from "@/components/portal/ui/Panel";
import { SkeletonLines } from "@/components/portal/ui/StateViews";
import { listPortalAudit } from "@/lib/supabase/portalUsersRepo";
import type { PortalAuditEntry } from "@/lib/supabase/portalAuth.types";
import styles from "./SettingsSection.module.css";
import { describeAuditEntry, formatAuditMoment } from "./auditText";

/**
 * Журнал действий администратора и входов.
 *
 * Читается из `portal_audit_log`: записи туда делают только SECURITY DEFINER
 * функции, приложение не может ни вставить, ни изменить, ни удалить их.
 * Паролей в журнале нет — фиксируется только факт смены.
 *
 * Текст строки собирает `auditText.ts`. Он вынесен отдельно после падения на
 * бою: `details` — чужой JSON семи разных функций, и одна запись
 * неожиданной формы уносила весь раздел «Настройки», потому что Error
 * Boundary в портале нет.
 */

const AUDIT_LIMIT = 50;

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
              <span className={styles.auditText}>{describeAuditEntry(entry)}</span>
              <span className={styles.auditTime}>{formatAuditMoment(entry.created_at)}</span>
            </div>
          ))}
      </PanelBody>
    </Panel>
  );
}
