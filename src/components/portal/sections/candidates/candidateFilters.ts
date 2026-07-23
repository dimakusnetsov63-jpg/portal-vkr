import type { Candidate } from "@/lib/supabase/candidates.types";

/** Active filter state for the candidate registry. */
export interface CandidateFilters {
  /** Free-text query matched against name, phone, telegram, max, external id, city. */
  search: string;
  /** Exact project match; empty string means "all projects". */
  project: string;
  /** Exact stage match; empty string means "all stages". */
  stage: string;
  /** When false, archived candidates are excluded. */
  showArchived: boolean;
}

/**
 * Pure filtering of the candidate list. No React, no Supabase — same result as
 * the inline logic it replaces, so memoization/behaviour is unchanged.
 */
export function filterCandidates(candidates: Candidate[], filters: CandidateFilters): Candidate[] {
  const q = filters.search.trim().toLowerCase();
  return candidates.filter((c) => {
    if (!filters.showArchived && c.archived_at) return false;
    if (filters.project && c.project !== filters.project) return false;
    if (filters.stage && (c.stage ?? "") !== filters.stage) return false;
    if (q) {
      const haystack = [c.full_name, c.phone, c.telegram_tag, c.max_tag, c.external_id, c.city]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}
