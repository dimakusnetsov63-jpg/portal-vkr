"use client";

import { useCallback, useEffect, useState } from "react";
import { Panel, PanelBody, PanelHead } from "@/components/portal/ui/Panel";
import { Button } from "@/components/portal/ui/Button";
import { SkeletonLines } from "@/components/portal/ui/StateViews";
import { usePortal } from "@/components/portal/context/PortalContext";
import { listImportHistory } from "@/lib/supabase/staffingDemandImportsRepo";
import { canRevertImport, revertImport } from "@/lib/imports/revertImport";
import type { StaffingDemandImportRow } from "@/lib/supabase/staffingDemandImports.types";
import styles from "./SettingsSection.module.css";

const HISTORY_LIMIT = 50;

const MODE_LABELS: Record<string, string> = {
  replace: "Заменить",
  add: "Добавить",
  sync: "Синхронизировать",
};
const STATUS_LABELS: Record<string, string> = {
  success: "Успешно",
  partial: "С ошибками",
  failed: "Не удалось",
  reverted: "Отменён",
};

function formatMoment(iso: string): string {
  const date = new Date(iso);
  return `${date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })}, ${date.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

/**
 * Журнал импортов потребности из Excel (раздел «Адреса»). Видна только
 * руководителю, как «Команда и роли»/«Журнал действий» — тот же гейт
 * `can('users')`, см. SettingsSection.tsx.
 */
export function ImportHistoryPanel() {
  const { pushToast } = usePortal();
  const [entries, setEntries] = useState<StaffingDemandImportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revertingId, setRevertingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEntries(await listImportHistory(HISTORY_LIMIT));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить историю импортов");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- начальная загрузка истории
    refresh();
  }, [refresh]);

  async function handleRevert(entry: StaffingDemandImportRow) {
    setRevertingId(entry.id);
    try {
      await revertImport(entry);
      pushToast("Импорт отменён");
      await refresh();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "Не удалось отменить импорт", "error");
    } finally {
      setRevertingId(null);
    }
  }

  return (
    <Panel>
      <PanelHead>
        <h3>История импортов потребности</h3>
        <span className={styles.fieldNote}>Последние {HISTORY_LIMIT}</span>
      </PanelHead>
      <PanelBody>
        {loading && <SkeletonLines lines={4} />}
        {!loading && error && <p className={styles.fieldError}>{error}</p>}
        {!loading && !error && entries.length === 0 && <p className={styles.fieldNote}>Импортов пока не было.</p>}
        {!loading &&
          !error &&
          entries.map((entry) => (
            <div className={styles.auditRow} key={entry.id}>
              <span className={styles.auditText}>
                @{entry.created_by_login ?? "—"} загрузил «{entry.file_name}» ({entry.project}, режим{" "}
                {MODE_LABELS[entry.mode] ?? entry.mode}
                {entry.dry_run ? ", проверка" : ""}): {entry.imported_rows}/{entry.total_rows} строк,{" "}
                {entry.error_rows} ошибок, {entry.new_rows} новых, {entry.updated_rows} обновлено
                {entry.zeroed_rows > 0 ? `, ${entry.zeroed_rows} обнулено` : ""} —{" "}
                {STATUS_LABELS[entry.status] ?? entry.status}
              </span>
              <span className={styles.auditTime}>
                {formatMoment(entry.created_at)}
                {canRevertImport(entry) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={revertingId !== null}
                    onClick={() => handleRevert(entry)}
                  >
                    {revertingId === entry.id ? "Отмена…" : "Отменить импорт"}
                  </Button>
                )}
              </span>
            </div>
          ))}
      </PanelBody>
    </Panel>
  );
}
