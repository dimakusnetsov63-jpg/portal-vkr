import type { StaffingDemandRow } from "@/lib/supabase/staffingDemand.types";

/** Active filter state for the demand matrix. */
export interface DemandFilters {
  /** Free-text query matched against project, city and position. */
  search: string;
  /** Exact project match; empty string means "all projects". */
  project: string;
  /** Exact city match; empty string means "all cities". */
  city: string;
  /** Exact position match; empty string means "all positions". */
  position: string;
}

/** Pure filtering of demand rows. No React, no Supabase. */
export function filterDemandRows(rows: StaffingDemandRow[], filters: DemandFilters): StaffingDemandRow[] {
  const q = filters.search.trim().toLowerCase();
  return rows.filter((r) => {
    if (filters.project && r.project !== filters.project) return false;
    if (filters.city && r.city !== filters.city) return false;
    if (filters.position && r.position !== filters.position) return false;
    if (q && !`${r.project} ${r.city} ${r.position}`.toLowerCase().includes(q)) return false;
    return true;
  });
}
