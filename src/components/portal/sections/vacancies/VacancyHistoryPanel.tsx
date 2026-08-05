"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/portal/ui/Modal";
import { SkeletonLines } from "@/components/portal/ui/StateViews";
import { fmtDateTime } from "@/lib/portal/format";
import { listVacancyProjectHistory } from "@/lib/supabase/vacancyHistoryRepo";
import type { VacancyHistoryEntityType, VacancyHistoryRow } from "@/lib/supabase/vacancyProjects.types";
import styles from "./VacancyDetail.module.css";

const ENTITY_LABELS: Record<VacancyHistoryEntityType, string> = {
  project: "Вакансия",
  section: "Раздел",
  field: "Поле",
  attachment: "Вложение",
};

const ACTION_LABELS: Record<VacancyHistoryRow["action"], string> = {
  insert: "добавлен(о)",
  update: "изменён(о)",
  delete: "удалён(о)",
};

function entryName(row: VacancyHistoryRow): string | null {
  const data = (row.new_data ?? row.old_data) as Record<string, unknown> | null;
  const name = data?.title ?? data?.label;
  return typeof name === "string" && name.trim() !== "" ? name : null;
}

/** Только чтение: снимки старой/новой строки, не построчный diff-viewer — см. vacancy_history в миграции. */
export function VacancyHistoryPanel({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [rows, setRows] = useState<VacancyHistoryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listVacancyProjectHistory(projectId)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Не удалось загрузить историю");
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return (
    <Modal open onClose={onClose} title="История изменений">
      {rows === null && !error && <SkeletonLines lines={5} />}
      {error && <p>{error}</p>}
      {rows !== null && rows.length === 0 && <p>Изменений пока нет.</p>}
      {rows !== null && rows.length > 0 && (
        <ul className={styles.historyList}>
          {rows.map((row) => {
            const name = entryName(row);
            return (
              <li key={row.id}>
                <span className={styles.historyWhen}>{fmtDateTime(new Date(row.changed_at))}</span>
                <span>
                  {row.changed_by_login ?? "Система"} — {ENTITY_LABELS[row.entity_type]} {ACTION_LABELS[row.action]}
                  {name && <> — «{name}»</>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
