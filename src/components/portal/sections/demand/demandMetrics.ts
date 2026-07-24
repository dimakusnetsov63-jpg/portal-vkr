import type { DemandColumn, DemandMatrixData } from "./demandAggregate";

/** Sum of every dated value for one city across the whole visible period. */
export function cityPeriodTotal(cityDates: Record<string, number> | undefined): number {
  if (!cityDates) return 0;
  return Object.values(cityDates).reduce((sum, n) => sum + n, 0);
}

/** Sum of cityPeriodTotal across every city of one project. */
export function projectPeriodTotal(matrix: DemandMatrixData, project: string): number {
  const cities = matrix[project];
  if (!cities) return 0;
  return Object.values(cities).reduce((sum, dates) => sum + cityPeriodTotal(dates), 0);
}

/** Per-column (per-date) sums across the given visible (project, city) pairs — for the pinned totals row. */
export function grandTotalsByColumn(
  matrix: DemandMatrixData,
  visible: { project: string; city: string }[],
  columns: DemandColumn[],
): number[] {
  return columns.map((col) =>
    visible.reduce((sum, { project, city }) => sum + (matrix[project]?.[city]?.[col.key] ?? 0), 0),
  );
}

/** Grand total across the entire visible period, for the bottom-right corner of the totals row. */
export function grandPeriodTotal(matrix: DemandMatrixData, visible: { project: string; city: string }[]): number {
  return visible.reduce((sum, { project, city }) => sum + cityPeriodTotal(matrix[project]?.[city]), 0);
}
