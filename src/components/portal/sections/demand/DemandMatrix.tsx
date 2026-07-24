"use client";

import { useHorizontalScrollSync } from "@/components/portal/ui/useHorizontalScrollSync";
import { DemandProjectRow } from "./DemandProjectRow";
import type { DemandColumn, DemandMatrixData } from "./demandAggregate";
import { grandPeriodTotal, grandTotalsByColumn } from "./demandMetrics";
import styles from "./DemandSection.module.css";

export function DemandMatrix({
  grouped,
  columns,
  matrix,
  collapsed,
  onToggleCollapse,
  onSaveCell,
}: {
  grouped: { project: string; cities: string[] }[];
  columns: DemandColumn[];
  matrix: DemandMatrixData;
  collapsed: Record<string, boolean>;
  onToggleCollapse: (project: string) => void;
  onSaveCell: (project: string, city: string, dateIso: string, next: number | null) => Promise<boolean>;
}) {
  const { scrollRef, fakeRef, innerWidth } = useHorizontalScrollSync();
  const visible = grouped.flatMap((g) => g.cities.map((city) => ({ project: g.project, city })));
  const columnTotals = grandTotalsByColumn(matrix, visible, columns);
  const grandTotal = grandPeriodTotal(matrix, visible);

  return (
    <div className={styles.tableWrap}>
      <div className={`${styles.tableScroll} scroll-x`} ref={scrollRef}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={`${styles.headCell} ${styles.projectCol}`}>Проект / Город</th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`${styles.headCell} ${styles.dateCol} ${col.weekend ? styles.dateColWeekend : ""}`}
                >
                  {col.label}
                  <span className={styles.dow}>{col.sub}</span>
                </th>
              ))}
              <th className={`${styles.headCell} ${styles.totalCol}`}>Итого</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map((g) => (
              <DemandProjectRow
                key={g.project}
                project={g.project}
                cities={g.cities}
                columns={columns}
                matrix={matrix}
                collapsed={!!collapsed[g.project]}
                onToggleCollapse={() => onToggleCollapse(g.project)}
                onSaveCell={onSaveCell}
              />
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className={`${styles.footCell} ${styles.projectCol}`}>Итого по всем проектам</td>
              {columns.map((col, i) => (
                <td key={col.key} className={`${styles.footCell} ${styles.dateCol}`}>
                  {columnTotals[i] || ""}
                </td>
              ))}
              <td className={`${styles.footCell} ${styles.totalCol}`}>{grandTotal || ""}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className={`${styles.hscrollFake} scroll-x`} ref={fakeRef}>
        <div className={styles.hscrollFakeInner} style={{ width: `${innerWidth}px` }} />
      </div>
    </div>
  );
}
