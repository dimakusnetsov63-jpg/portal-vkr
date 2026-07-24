"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/portal/ui/Button";
import { Modal } from "@/components/portal/ui/Modal";
import { createClient } from "@/lib/supabase/client";
import { fmtDate } from "@/lib/portal/format";
import { listStaffingDemandCellHistory } from "@/lib/supabase/staffingDemandHistoryRepo";
import type { StaffingDemandHistoryRow } from "@/lib/supabase/staffingDemandHistory.types";
import { describeAction, formatQuantityChange, resolveChangedByLabel } from "./demandHistory";
import styles from "./DemandSection.module.css";

/** Compact history view for one demand cell (project+city+date) — loaded only when opened, never eagerly. */
export function DemandHistoryDrawer({
  project,
  city,
  date,
  onClose,
}: {
  project: string;
  city: string;
  date: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<StaffingDemandHistoryRow[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const [{ data: userData }, history] = await Promise.all([
        supabase.auth.getUser(),
        listStaffingDemandCellHistory(project, city, date),
      ]);
      setCurrentUserId(userData.user?.id ?? null);
      setCurrentUserEmail(userData.user?.email ?? null);
      setEntries(history);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить историю изменений");
    } finally {
      setLoading(false);
    }
  }, [project, city, date]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lazy load on open, same pattern as the context's initial data loads
    load();
  }, [load]);

  const [y, m, d] = date.split("-").map(Number);
  const cellDateLabel = fmtDate(new Date(y, m - 1, d));

  return (
    <Modal open onClose={onClose} title={`История изменений — ${project}, ${city}, ${cellDateLabel}`}>
      {loading && <p className={styles.historyState}>Загрузка…</p>}

      {!loading && error && (
        <div className={styles.historyState}>
          <p>Не удалось загрузить историю изменений.</p>
          <Button size="sm" onClick={load}>
            Повторить
          </Button>
        </div>
      )}

      {!loading && !error && entries.length === 0 && <p className={styles.historyState}>Изменений пока нет.</p>}

      {!loading && !error && entries.length > 0 && (
        <ul className={styles.historyList}>
          {entries.map((entry) => (
            <li key={entry.id} className={styles.historyItem}>
              <div className={styles.historyItemHead}>
                <span className={styles.historyAction}>{describeAction(entry.action)}</span>
                <span className={styles.historyDate}>{new Date(entry.changed_at).toLocaleString("ru-RU")}</span>
              </div>
              <div className={styles.historyChange}>{formatQuantityChange(entry.old_quantity, entry.new_quantity)}</div>
              <div className={styles.historyBy}>
                {resolveChangedByLabel(entry.changed_by, currentUserId, currentUserEmail)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
