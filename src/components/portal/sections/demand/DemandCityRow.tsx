"use client";

import { usePortal } from "@/components/portal/context/PortalContext";
import { Icon } from "@/components/portal/ui/Icon";
import { getWeekRange, toIsoDate } from "@/lib/portal/demandWindow";
import { repeatWeekRows } from "./demandCopy";
import { DemandCell } from "./DemandCell";
import type { DemandColumn, DemandMatrixData } from "./demandAggregate";
import { cityPeriodTotal } from "./demandMetrics";
import { getRowMeta } from "./demandRowMeta";
import { DemandRowCommentButton } from "./DemandRowCommentButton";
import { DemandRowStatusBadge } from "./DemandRowStatusBadge";
import styles from "./DemandSection.module.css";

export function DemandCityRow({
  project,
  city,
  columns,
  matrix,
  onSaveCell,
}: {
  project: string;
  city: string;
  columns: DemandColumn[];
  matrix: DemandMatrixData;
  onSaveCell: (project: string, city: string, dateIso: string, next: number | null) => Promise<boolean>;
}) {
  const { bulkSetDemandCells, pushToast, demandRowMeta } = usePortal();
  const dates = matrix[project]?.[city] ?? {};
  const total = cityPeriodTotal(dates);
  const todayIso = toIsoDate(new Date());
  const meta = getRowMeta(demandRowMeta, project, city);

  async function handleRepeatWeek() {
    const { from } = getWeekRange();
    const rows = repeatWeekRows(dates, from).map((r) => ({ project, city, ...r }));
    if (rows.length === 0) {
      pushToast("В текущей неделе нет заполненных значений для этого города", "error");
      return;
    }
    const ok = await bulkSetDemandCells(rows);
    if (ok) pushToast("Строка скопирована на следующую неделю");
  }

  return (
    <tr className={styles.cityRow}>
      <td className={styles.colSticky}>
        <div className={styles.cityCell}>
          <Icon name="mapPin" size={13} />
          <span className={styles.cityName} title={city}>
            {city}
          </span>
          <DemandRowStatusBadge project={project} city={city} status={meta.status} />
          <DemandRowCommentButton project={project} city={city} comment={meta.comment} />
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
          date={col.key}
          value={dates[col.key] ?? null}
          isToday={col.key === todayIso}
          onSave={(next) => onSaveCell(project, city, col.key, next)}
        />
      ))}
      <td className={styles.totalColSticky}>{total || ""}</td>
    </tr>
  );
}
