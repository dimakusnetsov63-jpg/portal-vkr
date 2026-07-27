import type { DemandColumn, DemandMatrixData } from "./demandAggregate";

/** Sum of every dated value for one (project, city, position) across the whole visible period. */
export function positionPeriodTotal(dates: Record<string, number> | undefined): number {
  if (!dates) return 0;
  return Object.values(dates).reduce((sum, n) => sum + n, 0);
}

/** Sum of positionPeriodTotal across every position of one (project, city). */
export function cityPeriodTotal(matrix: DemandMatrixData, project: string, city: string): number {
  const positions = matrix[project]?.[city];
  if (!positions) return 0;
  return Object.values(positions).reduce((sum, dates) => sum + positionPeriodTotal(dates), 0);
}

/** Sum of cityPeriodTotal across every city of one project. */
export function projectPeriodTotal(matrix: DemandMatrixData, project: string): number {
  const cities = matrix[project];
  if (!cities) return 0;
  return Object.keys(cities).reduce((sum, city) => sum + cityPeriodTotal(matrix, project, city), 0);
}

/** Per-column (per-date) sums across the given visible (project, city, position) rows — for the pinned totals row. */
export function grandTotalsByColumn(
  matrix: DemandMatrixData,
  visible: { project: string; city: string; position: string }[],
  columns: DemandColumn[],
): number[] {
  return columns.map((col) =>
    visible.reduce((sum, { project, city, position }) => sum + (matrix[project]?.[city]?.[position]?.[col.key] ?? 0), 0),
  );
}

/** Grand total across the entire visible period, for the bottom-right corner of the totals row. */
export function grandPeriodTotal(
  matrix: DemandMatrixData,
  visible: { project: string; city: string; position: string }[],
): number {
  return visible.reduce((sum, { project, city, position }) => sum + positionPeriodTotal(matrix[project]?.[city]?.[position]), 0);
}
