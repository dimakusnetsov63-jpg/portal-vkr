"use client";

import { Icon } from "@/components/portal/ui/Icon";
import { avatarColor } from "@/lib/portal/format";
import { toIsoDate } from "@/lib/portal/demandWindow";
import { DemandCityGroupRow } from "./DemandCityGroupRow";
import { demandCityGroupKey, type DemandColumn, type DemandMatrixData } from "./demandAggregate";
import { projectPeriodTotal } from "./demandMetrics";
import styles from "./DemandSection.module.css";

export function DemandProjectRow({
  project,
  cities,
  columns,
  matrix,
  collapsed,
  onToggleCollapse,
  collapsedCities,
  onToggleCityCollapse,
  onSaveCell,
}: {
  project: string;
  cities: { city: string; positions: string[] }[];
  columns: DemandColumn[];
  matrix: DemandMatrixData;
  collapsed: boolean;
  onToggleCollapse: () => void;
  collapsedCities: Record<string, boolean>;
  onToggleCityCollapse: (city: string) => void;
  onSaveCell: (project: string, city: string, position: string, dateIso: string, next: number | null) => Promise<boolean>;
}) {
  const total = projectPeriodTotal(matrix, project);
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
        cities.map(({ city, positions }) => (
          <DemandCityGroupRow
            key={city}
            project={project}
            city={city}
            positions={positions}
            columns={columns}
            matrix={matrix}
            collapsed={!!collapsedCities[demandCityGroupKey(project, city)]}
            onToggleCollapse={() => onToggleCityCollapse(city)}
            onSaveCell={onSaveCell}
          />
        ))}
    </>
  );
}
