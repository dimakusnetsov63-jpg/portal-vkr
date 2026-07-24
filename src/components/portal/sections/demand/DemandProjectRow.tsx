"use client";

import { Icon } from "@/components/portal/ui/Icon";
import { avatarColor } from "@/lib/portal/format";
import { toIsoDate } from "@/lib/portal/demandWindow";
import { DemandCityRow } from "./DemandCityRow";
import type { DemandColumn, DemandMatrixData } from "./demandAggregate";
import { cityPeriodTotal } from "./demandMetrics";
import styles from "./DemandSection.module.css";

export function DemandProjectRow({
  project,
  cities,
  columns,
  matrix,
  collapsed,
  onToggleCollapse,
  onSaveCell,
}: {
  project: string;
  cities: string[];
  columns: DemandColumn[];
  matrix: DemandMatrixData;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onSaveCell: (project: string, city: string, dateIso: string, next: number | null) => Promise<boolean>;
}) {
  const total = cities.reduce((sum, city) => sum + cityPeriodTotal(matrix[project]?.[city]), 0);
  const todayIso = toIsoDate(new Date());

  return (
    <>
      <tr>
        <td className={styles.colSticky}>
          <div className={styles.projHead}>
            <button type="button" onClick={onToggleCollapse} aria-label="Свернуть/развернуть проект">
              <span className={`${styles.projHeadChevron} ${collapsed ? styles.projHeadCollapsedChevron : ""}`}>
                <Icon name="chevron" size={14} />
              </span>
            </button>
            <span className={styles.swatch} style={{ background: avatarColor(project) }} />
            {project}
          </div>
        </td>
        {columns.map((col) => (
          <td key={col.key} className={col.key === todayIso ? styles.dateColToday : ""} />
        ))}
        <td className={styles.totalColSticky}>{total || ""}</td>
      </tr>
      {!collapsed &&
        cities.map((city) => (
          <DemandCityRow
            key={city}
            project={project}
            city={city}
            columns={columns}
            matrix={matrix}
            onSaveCell={onSaveCell}
          />
        ))}
    </>
  );
}
