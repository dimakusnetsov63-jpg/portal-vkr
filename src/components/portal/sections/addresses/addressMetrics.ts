import type { AddressRow } from "@/lib/supabase/addresses.types";

/**
 * Дефицит и укомплектованность — НЕ хранятся в БД, всегда считаются здесь из
 * `required_count`/`staffed_count` (см. миграцию и requirements/addresses.md,
 * «Архитектурные дополнения» ТЗ). При отсутствии потребности (`required_count
 * === 0`) укомплектованность — явно `100%`, а не `0%`: это осознанное
 * отличие от общего правила «пусто/0 → 0%», так задано для этого раздела.
 */
export function addressDeficit(row: AddressRow): number {
  return row.required_count - row.staffed_count;
}

export function addressFillRate(row: AddressRow): number {
  if (row.required_count === 0) return 100;
  return (row.staffed_count / row.required_count) * 100;
}

export interface AddressMetrics {
  total: number;
  active: number;
  archived: number;
  totalDemand: number;
  closedPositions: number;
  openDemand: number;
  criticalCount: number;
  avgFillRatePct: number;
}

/**
 * Pure metric computation. Two separate inputs on purpose:
 *  - `allRows` — the whole loaded dataset, used only for
 *    «Всего/Активных/Архивных адресов»: these three never depend on the
 *    current filters or the Активные/Архив toggle;
 *  - `activeFilteredRows` — the currently-filtered set with archived
 *    addresses already excluded (regardless of which tab is open), used for
 *    every other KPI: archived addresses never participate in KPI по ТЗ.
 *
 * An empty `activeFilteredRows` yields 0 for every KPI (never NaN, no
 * divide-by-zero) — same convention as calculateCandidateMetrics.
 */
export function calculateAddressMetrics(allRows: AddressRow[], activeFilteredRows: AddressRow[]): AddressMetrics {
  const total = allRows.length;
  const archived = allRows.filter((a) => Boolean(a.archived_at)).length;
  const active = total - archived;

  let totalDemand = 0;
  let closedPositions = 0;
  let openDemand = 0;
  let criticalCount = 0;
  let fillRateSum = 0;

  for (const a of activeFilteredRows) {
    totalDemand += a.required_count;
    closedPositions += a.staffed_count;
    openDemand += Math.max(addressDeficit(a), 0);
    if (a.priority === 5) criticalCount += 1;
    fillRateSum += addressFillRate(a);
  }

  const avgFillRatePct =
    activeFilteredRows.length === 0 ? 0 : Math.round(fillRateSum / activeFilteredRows.length);

  return { total, active, archived, totalDemand, closedPositions, openDemand, criticalCount, avgFillRatePct };
}
