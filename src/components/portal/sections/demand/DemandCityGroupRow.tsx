"use client";

import { Icon } from "@/components/portal/ui/Icon";
import { toIsoDate } from "@/lib/portal/demandWindow";
import { DemandPositionRow } from "./DemandPositionRow";
import type { DemandColumn, DemandMatrixData } from "./demandAggregate";
import { cityPeriodTotal } from "./demandMetrics";
import styles from "./DemandSection.module.css";

/** Middle grouping row: one city within a project, expanded into its visible positions. Collapsing a city never affects sibling cities or the parent project. */
export function DemandCityGroupRow({
  project,
  city,
  positions,
  columns,
  matrix,
  collapsed,
  onToggleCollapse,
  onSaveCell,
}: {
  project: string;
  city: string;
  positions: string[];
  columns: DemandColumn[];
  matrix: DemandMatrixData;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onSaveCell: (project: string, city: string, position: string, dateIso: string, next: number | null) => Promise<boolean>;
}) {
  const total = cityPeriodTotal(matrix, project, city);
  const todayIso = toIsoDate(new Date());

  return (
    <>
      <tr className={styles.cityGroupRow}>
        <td className={styles.colSticky}>
          <div className={styles.cityGroupCell}>
            <button type="button" onClick={onToggleCollapse} aria-label="Свернуть/развернуть город">
              <span className={`${styles.cityGroupChevron} ${collapsed ? styles.cityGroupCollapsedChevron : ""}`}>
                <Icon name="chevron" size={14} />
              </span>
            </button>
            <Icon name="mapPin" size={14} />
            <span className={styles.cityGroupName} title={city}>
              {city}
            </span>
          </div>
        </td>
        {columns.map((col) => (
          <td key={col.key} className={col.key === todayIso ? styles.dateColToday : ""} />
        ))}
        <td className={styles.totalColSticky}>{total || ""}</td>
      </tr>
      {!collapsed &&
        positions.map((position) => (
          <DemandPositionRow
            key={position}
            project={project}
            city={city}
            position={position}
            columns={columns}
            matrix={matrix}
            onSaveCell={onSaveCell}
          />
        ))}
    </>
  );
}
