"use client";

import { useEffect } from "react";
import { useHorizontalScrollSync } from "@/components/portal/ui/useHorizontalScrollSync";
import { toIsoDate } from "@/lib/portal/demandWindow";
import { DemandProjectRow } from "./DemandProjectRow";
import type { DemandColumn, DemandGroupedProject, DemandMatrixData } from "./demandAggregate";
import { grandPeriodTotal, grandTotalsByColumn } from "./demandMetrics";
import styles from "./DemandSection.module.css";

export function DemandMatrix({
  grouped,
  columns,
  matrix,
  collapsed,
  onToggleCollapse,
  collapsedCities,
  onToggleCityCollapse,
  onSaveCell,
  scrollToTodaySignal,
}: {
  grouped: DemandGroupedProject[];
  columns: DemandColumn[];
  matrix: DemandMatrixData;
  collapsed: Record<string, boolean>;
  onToggleCollapse: (project: string) => void;
  collapsedCities: Record<string, boolean>;
  onToggleCityCollapse: (project: string, city: string) => void;
  onSaveCell: (project: string, city: string, position: string, dateIso: string, next: number | null) => Promise<boolean>;
  /** Bumped by the "Сегодня" button to trigger a scroll to today's column. */
  scrollToTodaySignal?: number;
}) {
  const { scrollRef, fakeRef, innerWidth } = useHorizontalScrollSync();
  const visible = grouped.flatMap((g) =>
    g.cities.flatMap((c) => c.positions.map((position) => ({ project: g.project, city: c.city, position }))),
  );
  const columnTotals = grandTotalsByColumn(matrix, visible, columns);
  const grandTotal = grandPeriodTotal(matrix, visible);
  const todayIso = toIsoDate(new Date());

  useEffect(() => {
    if (!scrollToTodaySignal) return;
    const el = scrollRef.current?.querySelector<HTMLElement>('[data-today="true"]');
    el?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scrollRef is stable, only the signal should retrigger this
  }, [scrollToTodaySignal]);

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
                  data-today={col.key === todayIso ? "true" : undefined}
                  className={`${styles.headCell} ${styles.dateCol} ${col.weekend ? styles.dateColWeekend : ""} ${col.key === todayIso ? styles.dateColToday : ""}`}
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
                collapsedCities={collapsedCities}
                onToggleCityCollapse={(city) => onToggleCityCollapse(g.project, city)}
                onSaveCell={onSaveCell}
              />
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className={`${styles.footCell} ${styles.projectCol}`}>Итого по всем проектам</td>
              {columns.map((col, i) => (
                <td
                  key={col.key}
                  className={`${styles.footCell} ${styles.dateCol} ${col.key === todayIso ? styles.dateColToday : ""}`}
                >
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
