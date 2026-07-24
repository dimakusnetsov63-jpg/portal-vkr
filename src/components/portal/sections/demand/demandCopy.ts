import { addIsoDays, enumerateIsoDates, getWeekRange } from "@/lib/portal/demandWindow";

/** Copy target: the single day right after `date`. */
export function nextDayTarget(date: string): string[] {
  return untilDateTargets(date, addIsoDays(date, 1));
}

/** Copy targets: the 7 days right after `date` (date+1..date+7). */
export function next7DaysTargets(date: string): string[] {
  return untilDateTargets(date, addIsoDays(date, 7));
}

/** Copy targets: every day strictly after `date` up to and including `until`. Empty if `until` is not after `date`. */
export function untilDateTargets(date: string, until: string): string[] {
  if (until <= date) return [];
  return enumerateIsoDates(addIsoDays(date, 1), until);
}

/** Copy targets: the rest of the Mon–Sun week containing `date`, excluding `date` itself. */
export function currentWeekTargets(date: string): string[] {
  const { from, to } = getWeekRange(date);
  return enumerateIsoDates(from, to).filter((d) => d !== date);
}

/**
 * Given one city's cells (isoDate -> plannedCount) and the Monday of the week
 * to repeat, builds bulk rows that copy every cell falling within that week
 * to the same weekday 7 days later. Cells outside that week are ignored.
 */
export function repeatWeekRows(
  cityCells: Record<string, number>,
  weekFrom: string,
): { demand_date: string; planned_count: number }[] {
  const weekTo = addIsoDays(weekFrom, 6);
  const rows: { demand_date: string; planned_count: number }[] = [];
  for (const [date, plannedCount] of Object.entries(cityCells)) {
    if (date < weekFrom || date > weekTo) continue;
    rows.push({ demand_date: addIsoDays(date, 7), planned_count: plannedCount });
  }
  return rows;
}
