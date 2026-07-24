"use client";

import { Icon } from "@/components/portal/ui/Icon";
import { DemandCell } from "./DemandCell";
import type { DemandColumn, DemandMatrixData } from "./demandAggregate";
import { cityPeriodTotal } from "./demandMetrics";
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
  const dates = matrix[project]?.[city] ?? {};
  const total = cityPeriodTotal(dates);

  return (
    <tr>
      <td className={styles.colSticky}>
        <div className={styles.cityCell}>
          <Icon name="mapPin" size={13} />
          {city}
        </div>
      </td>
      {columns.map((col) => (
        <DemandCell
          key={col.key}
          value={dates[col.key] ?? null}
          onSave={(next) => onSaveCell(project, city, col.key, next)}
        />
      ))}
      <td className={styles.totalColSticky}>{total || ""}</td>
    </tr>
  );
}
