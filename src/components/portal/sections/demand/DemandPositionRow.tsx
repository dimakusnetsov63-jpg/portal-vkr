"use client";

import { usePortal } from "@/components/portal/context/PortalContext";
import { Icon } from "@/components/portal/ui/Icon";
import { getWeekRange, toIsoDate } from "@/lib/portal/demandWindow";
import { repeatWeekRows } from "./demandCopy";
import { DemandCell } from "./DemandCell";
import type { DemandColumn, DemandMatrixData } from "./demandAggregate";
import { positionPeriodTotal } from "./demandMetrics";
import { getRowMeta } from "./demandRowMeta";
import { DemandRowCommentButton } from "./DemandRowCommentButton";
import { DemandRowStatusBadge } from "./DemandRowStatusBadge";
import styles from "./DemandSection.module.css";

/** Leaf row of the matrix: one (project, city, position) — status/comment, cells by date, "repeat week" action. */
export function DemandPositionRow({
  project,
  city,
  position,
  columns,
  matrix,
  onSaveCell,
}: {
  project: string;
  city: string;
  position: string;
  columns: DemandColumn[];
  matrix: DemandMatrixData;
  onSaveCell: (project: string, city: string, position: string, dateIso: string, next: number | null) => Promise<boolean>;
}) {
  const { bulkSetDemandCells, pushToast, demandRowMeta } = usePortal();
  const dates = matrix[project]?.[city]?.[position] ?? {};
  const total = positionPeriodTotal(dates);
  const todayIso = toIsoDate(new Date());
  const meta = getRowMeta(demandRowMeta, project, city, position);

  async function handleRepeatWeek() {
    const { from } = getWeekRange();
    const rows = repeatWeekRows(dates, from).map((r) => ({ project, city, position, ...r }));
    if (rows.length === 0) {
      pushToast("В текущей неделе нет заполненных значений для этой должности", "error");
      return;
    }
    const ok = await bulkSetDemandCells(rows);
    if (ok) pushToast("Строка скопирована на следующую неделю");
  }

  return (
    <tr className={styles.positionRow}>
      <td className={styles.colSticky}>
        <div className={styles.positionCell}>
          <Icon name="briefcase" size={13} />
          <span className={styles.positionName} title={position}>
            {position}
          </span>
          <DemandRowStatusBadge project={project} city={city} position={position} status={meta.status} />
          <DemandRowCommentButton project={project} city={city} position={position} comment={meta.comment} />
          <button
            type="button"
            className={styles.repeatWeekButton}
            title="Повторить строку на следующую неделю"
            aria-label="Повторить строку на следующую неделю"
            onClick={handleRepeatWeek}
          >
            <Icon name="refresh" size={12} />
          </button>
        </div>
      </td>
      {columns.map((col) => (
        <DemandCell
          key={col.key}
          project={project}
          city={city}
          position={position}
          date={col.key}
          value={dates[col.key] ?? null}
          isToday={col.key === todayIso}
          onSave={(next) => onSaveCell(project, city, position, col.key, next)}
        />
      ))}
      <td className={styles.totalColSticky}>{total || ""}</td>
    </tr>
  );
}
