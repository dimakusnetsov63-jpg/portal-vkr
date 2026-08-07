import type { DemandColumn, DemandMatrixData } from "./demandAggregate";

/**
 * Средняя дневная потребность одного (project, city, position) за видимый
 * период — сумма значений по дням, где потребность выставлена, делённая
 * на число таких дней, а не сумма за весь период. Сумма за произвольное
 * (не обязательно семидневное) окно вводила в заблуждение: 05.08=100 и
 * 06.08=200 показывали «Итого 300», хотя типичная дневная потребность —
 * 150. Дни без выставленного значения (отсутствие строки в матрице — не то
 * же самое, что явный 0) не входят в знаменатель: «данных меньше периода» —
 * среднее считается по тому, что есть, см. docs/requirements/demand.md.
 * Округляется до целого — это количество человек.
 */
export function positionPeriodTotal(dates: Record<string, number> | undefined): number {
  if (!dates) return 0;
  const values = Object.values(dates);
  if (values.length === 0) return 0;
  const sum = values.reduce((s, n) => s + n, 0);
  return Math.round(sum / values.length);
}

/** Сумма средних дневных потребностей (positionPeriodTotal) по всем должностям города — не «средняя от средних», а суммарная типичная дневная нагрузка города (курьеры и кассиры нужны одновременно, поэтому их дневные средние складываются, а не усредняются между собой). */
export function cityPeriodTotal(matrix: DemandMatrixData, project: string, city: string): number {
  const positions = matrix[project]?.[city];
  if (!positions) return 0;
  return Object.values(positions).reduce((sum, dates) => sum + positionPeriodTotal(dates), 0);
}

/** Сумма cityPeriodTotal по всем городам проекта — тем же принципом, что и cityPeriodTotal. */
export function projectPeriodTotal(matrix: DemandMatrixData, project: string): number {
  const cities = matrix[project];
  if (!cities) return 0;
  return Object.keys(cities).reduce((sum, city) => sum + cityPeriodTotal(matrix, project, city), 0);
}

/** Per-column (per-date) sums across the given visible (project, city, position) rows — for the pinned totals row. One date = nothing to average over here, unlike the period totals above. */
export function grandTotalsByColumn(
  matrix: DemandMatrixData,
  visible: { project: string; city: string; position: string }[],
  columns: DemandColumn[],
): number[] {
  return columns.map((col) =>
    visible.reduce((sum, { project, city, position }) => sum + (matrix[project]?.[city]?.[position]?.[col.key] ?? 0), 0),
  );
}

/** Сумма средних дневных потребностей (positionPeriodTotal) по всем видимым строкам — для правого нижнего угла строки итогов, тем же принципом, что и cityPeriodTotal/projectPeriodTotal. */
export function grandPeriodTotal(
  matrix: DemandMatrixData,
  visible: { project: string; city: string; position: string }[],
): number {
  return visible.reduce((sum, { project, city, position }) => sum + positionPeriodTotal(matrix[project]?.[city]?.[position]), 0);
}
