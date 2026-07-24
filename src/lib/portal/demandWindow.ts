/** How many days before/after today the default "Потребность" view loads. */
export const DEMAND_WINDOW_DAYS_BEFORE = 14;
export const DEMAND_WINDOW_DAYS_AFTER = 45;

export interface DemandWindow {
  from: string;
  to: string;
}

/** Formats a Date as a local (not UTC) ISO date string "YYYY-MM-DD". */
export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Adds `n` (possibly negative) days to an ISO date string, staying in local time. */
export function addIsoDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return toIsoDate(new Date(y, m - 1, d + n));
}

/** All ISO dates from `fromDate` to `toDate`, inclusive. */
export function enumerateIsoDates(fromDate: string, toDate: string): string[] {
  const dates: string[] = [];
  for (let cursor = fromDate; cursor <= toDate; cursor = addIsoDays(cursor, 1)) {
    dates.push(cursor);
  }
  return dates;
}

/** Default visible window for the day-mode "Потребность" matrix, anchored to the real current date. */
export function defaultDemandWindow(today: Date = new Date()): DemandWindow {
  const todayIso = toIsoDate(today);
  return {
    from: addIsoDays(todayIso, -DEMAND_WINDOW_DAYS_BEFORE),
    to: addIsoDays(todayIso, DEMAND_WINDOW_DAYS_AFTER),
  };
}
