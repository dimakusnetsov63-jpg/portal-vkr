import type { RateSchedule, RateUnit } from "@/lib/supabase/rates.types";
import type { RateWithCard } from "./rateMetrics";

/** Active filter state for the rates registry. */
export interface RateFilters {
  /** Free-text query, matched against several fields at once — see below. */
  search: string;
  /** Exact project match; empty string means "all projects". */
  project: string;
  /** Exact city match; empty string means "all cities". */
  city: string;
  /** Exact legal entity match; empty string means "all legal entities". */
  legalEntity: string;
  /** Exact position match; empty string means "all positions". */
  position: string;
  /** Exact unit match; empty string means "all units". */
  unit: RateUnit | "";
  /** Exact schedule match; empty string means "all schedules". */
  schedule: RateSchedule | "";
}

/**
 * Pure filtering over the already-joined rate+card list. No React, no
 * Supabase — runs entirely over the already-loaded data in memory, same
 * convention as filterAddresses.
 *
 * `search` matches across several fields at once (position, project, city,
 * legal entity, comment) — the user should not have to pick a field to
 * search a known value in.
 */
export function filterRates(rows: RateWithCard[], filters: RateFilters): RateWithCard[] {
  const q = filters.search.trim().toLowerCase();
  return rows.filter(({ rate, card }) => {
    if (filters.project && card.project !== filters.project) return false;
    if (filters.city && card.city !== filters.city) return false;
    if (filters.legalEntity && card.legal_entity !== filters.legalEntity) return false;
    if (filters.position && rate.position !== filters.position) return false;
    if (filters.unit && rate.unit !== filters.unit) return false;
    if (filters.schedule && rate.schedule !== filters.schedule) return false;
    if (q) {
      const haystack = [rate.position, card.project, card.city, card.legal_entity, rate.comment]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}
