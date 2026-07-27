import { addIsoDays, enumerateIsoDates } from "@/lib/portal/demandWindow";
import type { StaffingDemandRow } from "@/lib/supabase/staffingDemand.types";

export interface DemandColumn {
  /** ISO date (yyyy-mm-dd), also the key used to look up values in the matrix. */
  key: string;
  label: string;
  sub: string;
  weekend: boolean;
}

/** matrix[project][city][position][isoDate] = plannedCount. */
export type DemandMatrixData = Record<string, Record<string, Record<string, Record<string, number>>>>;

/** One project's grouped rows, each city expanded into its visible positions — the shape rendered by DemandMatrix/DemandProjectRow/DemandCityGroupRow. */
export interface DemandGroupedProject {
  project: string;
  cities: { city: string; positions: string[] }[];
}

/**
 * Stable composite key for (project, city) — used to key city-level collapse
 * state in DemandSection (independent of the project-level collapse state).
 * JSON.stringify rather than a delimiter-joined string, same reasoning as
 * demandRowMetaKey — avoids collisions when a value contains the delimiter.
 */
export function demandCityGroupKey(project: string, city: string): string {
  return JSON.stringify([project, city]);
}

/** Reshapes flat Supabase rows into the nested matrix the table renders from. */
export function buildDemandMatrix(rows: StaffingDemandRow[]): DemandMatrixData {
  const matrix: DemandMatrixData = {};
  for (const row of rows) {
    matrix[row.project] ??= {};
    matrix[row.project][row.city] ??= {};
    matrix[row.project][row.city][row.position] ??= {};
    matrix[row.project][row.city][row.position][row.demand_date] = row.planned_count;
  }
  return matrix;
}

/** Distinct (project, city, position) triples that have at least one row, sorted for stable display. No full cross-product of all known projects/cities/positions. */
export function listVisibleRows(rows: StaffingDemandRow[]): { project: string; city: string; position: string }[] {
  const seen = new Set<string>();
  const result: { project: string; city: string; position: string }[] = [];
  for (const row of rows) {
    const key = JSON.stringify([row.project, row.city, row.position]);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ project: row.project, city: row.city, position: row.position });
  }
  result.sort(
    (a, b) =>
      a.project.localeCompare(b.project, "ru") ||
      a.city.localeCompare(b.city, "ru") ||
      a.position.localeCompare(b.position, "ru"),
  );
  return result;
}

const WEEKDAY_SHORT = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

/** Day columns for [fromDate, toDate], both ISO dates, inclusive. */
export function getDayColumns(fromDate: string, toDate: string): DemandColumn[] {
  const columns: DemandColumn[] = [];
  for (let cursor = fromDate; cursor <= toDate; cursor = addIsoDays(cursor, 1)) {
    const [y, m, d] = cursor.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const dow = date.getDay();
    columns.push({
      key: cursor,
      label: date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }),
      sub: WEEKDAY_SHORT[dow],
      weekend: dow === 0 || dow === 6,
    });
  }
  return columns;
}

export type DemandCellLevel = "empty" | "zero" | "normal" | "elevated" | "critical";

/** Visual bucket for a cell's value: null = not set, 0 = none, then increasing bands. */
export function demandLevelForValue(value: number | null): DemandCellLevel {
  if (value === null) return "empty";
  if (value === 0) return "zero";
  if (value <= 4) return "normal";
  if (value <= 9) return "elevated";
  return "critical";
}

export function isValidPlannedCount(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

/** Above this many rows, "Добавить потребность" asks for an extra confirmation before saving — a bulk add across several cities/positions/dates multiplies fast and can otherwise overwrite far more than intended in one click. */
export const DEMAND_BULK_CONFIRM_THRESHOLD = 100;

export function isLargeBulkCount(totalCount: number): boolean {
  return totalCount > DEMAND_BULK_CONFIRM_THRESHOLD;
}

/** Pure row-building for the "Добавить потребность" bulk form: one row per (city × position × date) in the range, same count for all. */
export function buildBulkRows(input: {
  project: string;
  cities: string[];
  positions: string[];
  fromDate: string;
  toDate: string;
  plannedCount: number;
}): { project: string; city: string; position: string; demand_date: string; planned_count: number }[] {
  const dates = enumerateIsoDates(input.fromDate, input.toDate);
  return input.cities.flatMap((city) =>
    input.positions.flatMap((position) =>
      dates.map((demand_date) => ({
        project: input.project,
        city,
        position,
        demand_date,
        planned_count: input.plannedCount,
      })),
    ),
  );
}

/**
 * Keeps only the (project, city, position) rows where at least one cell in
 * the visible window satisfies `predicate` — e.g. "Только заполненные"
 * (`cell > 0`). Operates at the row level: a row is kept as soon as one of
 * its cells qualifies, it does not require every date to qualify, and it
 * never hides individual cells within a kept row.
 */
export function filterGroupsByCellPredicate(
  grouped: DemandGroupedProject[],
  matrix: DemandMatrixData,
  predicate: (cell: number) => boolean,
): DemandGroupedProject[] {
  return grouped
    .map((g) => ({
      project: g.project,
      cities: g.cities
        .map((c) => ({
          city: c.city,
          positions: c.positions.filter((position) =>
            Object.values(matrix[g.project]?.[c.city]?.[position] ?? {}).some(predicate),
          ),
        }))
        .filter((c) => c.positions.length > 0),
    }))
    .filter((g) => g.cities.length > 0);
}
