import { SUCCESSFUL_STAGES } from "@/lib/portal/candidateOptions";
import type { Candidate } from "@/lib/supabase/candidates.types";

/** Analytic stat-card counts + their share of the current selection. */
export interface CandidateMetrics {
  awaiting: number;
  awaitingPct: number;
  successful: number;
  successfulPct: number;
  medical: number;
  medicalPct: number;
}

/**
 * Pure metric computation over an already-filtered candidate list. Rules
 * preserved exactly from the inline version:
 *  - a candidate is "successful" if first_shift_at is set OR the stage is a
 *    successful one; "awaiting" and "successful" are mutually exclusive;
 *  - medical is counted independently;
 *  - an empty selection yields 0 counts and 0% (never NaN, no divide-by-zero).
 */
export function calculateCandidateMetrics(candidates: Candidate[]): CandidateMetrics {
  const total = candidates.length;
  let awaiting = 0;
  let successful = 0;
  let medical = 0;
  for (const c of candidates) {
    const isSuccessful = Boolean(c.first_shift_at) || (c.stage != null && SUCCESSFUL_STAGES.includes(c.stage));
    if (isSuccessful) successful += 1;
    else awaiting += 1;
    if (c.has_medical_book === true) medical += 1;
  }
  const pct = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100));
  return {
    awaiting,
    awaitingPct: pct(awaiting),
    successful,
    successfulPct: pct(successful),
    medical,
    medicalPct: pct(medical),
  };
}
