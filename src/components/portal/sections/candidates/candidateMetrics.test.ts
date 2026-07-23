import { describe, expect, it } from "vitest";
import type { Candidate } from "@/lib/supabase/candidates.types";
import { calculateCandidateMetrics } from "./candidateMetrics";

/** Build a valid Candidate row; override only the fields a test cares about. */
function makeCandidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: "id-1",
    external_id: null,
    full_name: "Иван Иванов",
    project: "Самокат",
    city: null,
    stage: null,
    recruiter: null,
    manager: null,
    coordinator: null,
    source: null,
    phone: null,
    telegram_tag: null,
    max_tag: null,
    comment: null,
    has_medical_book: null,
    salary_card: null,
    invitation_at: null,
    registration_at: null,
    first_shift_at: null,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    archived_at: null,
    ...overrides,
  };
}

describe("calculateCandidateMetrics", () => {
  it("counts a candidate with no first_shift_at and no successful stage as awaiting", () => {
    const m = calculateCandidateMetrics([makeCandidate({ stage: "Прибыл на проект", first_shift_at: null })]);
    expect(m.awaiting).toBe(1);
    expect(m.successful).toBe(0);
  });

  it("counts a candidate with first_shift_at as successful", () => {
    const m = calculateCandidateMetrics([
      makeCandidate({ stage: "Прибыл на проект", first_shift_at: "2026-07-05T08:00:00.000Z" }),
    ]);
    expect(m.successful).toBe(1);
    expect(m.awaiting).toBe(0);
  });

  it("counts a candidate with a successful stage as successful even without first_shift_at", () => {
    const m = calculateCandidateMetrics([makeCandidate({ stage: "Отработал 1 смену", first_shift_at: null })]);
    expect(m.successful).toBe(1);
    expect(m.awaiting).toBe(0);
  });

  it("never counts a candidate as both awaiting and successful (they partition the set)", () => {
    const list = [
      makeCandidate({ id: "1", stage: "Прибыл на проект" }), // awaiting
      makeCandidate({ id: "2", stage: "Завершил вахту" }), // successful (stage)
      makeCandidate({ id: "3", first_shift_at: "2026-07-05T08:00:00.000Z" }), // successful (date)
      makeCandidate({ id: "4", stage: null }), // awaiting
    ];
    const m = calculateCandidateMetrics(list);
    expect(m.awaiting + m.successful).toBe(list.length);
    expect(m.awaiting).toBe(2);
    expect(m.successful).toBe(2);
  });

  it("counts the medical book independently of awaiting/successful", () => {
    const list = [
      makeCandidate({ id: "1", stage: "Прибыл на проект", has_medical_book: true }), // awaiting + medical
      makeCandidate({ id: "2", first_shift_at: "2026-07-05T08:00:00.000Z", has_medical_book: true }), // successful + medical
      makeCandidate({ id: "3", has_medical_book: false }),
      makeCandidate({ id: "4", has_medical_book: null }),
    ];
    const m = calculateCandidateMetrics(list);
    expect(m.medical).toBe(2);
    // medical overlaps both buckets, so it is not bounded by either count:
    // candidates 1, 3, 4 are awaiting (null / "Прибыл на проект" stage, no
    // first shift); candidate 2 is successful (has first_shift_at).
    expect(m.awaiting).toBe(3);
    expect(m.successful).toBe(1);
  });

  it("computes percentages against the total number of candidates passed in", () => {
    const list = [
      makeCandidate({ id: "1", stage: "Прибыл на проект" }), // awaiting
      makeCandidate({ id: "2", stage: "Прибыл на проект" }), // awaiting
      makeCandidate({ id: "3", first_shift_at: "2026-07-05T08:00:00.000Z" }), // successful
      makeCandidate({ id: "4", has_medical_book: true }), // awaiting + medical
    ];
    const m = calculateCandidateMetrics(list);
    expect(m.awaiting).toBe(3);
    expect(m.awaitingPct).toBe(75); // 3/4
    expect(m.successful).toBe(1);
    expect(m.successfulPct).toBe(25); // 1/4
    expect(m.medicalPct).toBe(25); // 1/4
  });

  it("rounds percentages with Math.round (half up), matching the app", () => {
    // 1 of 3 -> 33.33 -> 33; 2 of 3 -> 66.67 -> 67
    const thirds = [
      makeCandidate({ id: "1", first_shift_at: "2026-07-05T08:00:00.000Z" }), // successful
      makeCandidate({ id: "2", stage: "Прибыл на проект" }), // awaiting
      makeCandidate({ id: "3", stage: "Прибыл на проект" }), // awaiting
    ];
    const m1 = calculateCandidateMetrics(thirds);
    expect(m1.successfulPct).toBe(33);
    expect(m1.awaitingPct).toBe(67);

    // 1 of 8 -> 12.5 -> Math.round rounds half up to 13
    const eighths = [
      makeCandidate({ id: "1", first_shift_at: "2026-07-05T08:00:00.000Z" }), // successful
      ...Array.from({ length: 7 }, (_, i) => makeCandidate({ id: `a${i}`, stage: "Прибыл на проект" })),
    ];
    const m2 = calculateCandidateMetrics(eighths);
    expect(m2.successfulPct).toBe(13);
  });

  it("returns zeros and no NaN for an empty array", () => {
    const m = calculateCandidateMetrics([]);
    expect(m).toEqual({
      awaiting: 0,
      awaitingPct: 0,
      successful: 0,
      successfulPct: 0,
      medical: 0,
      medicalPct: 0,
    });
    for (const v of Object.values(m)) expect(Number.isNaN(v)).toBe(false);
  });

  it("counts duplicate rows once per occurrence (documents current no-dedup behavior)", () => {
    // The function counts each array element independently; it does not
    // de-duplicate by id. Passing the same candidate twice counts it twice.
    const dup = makeCandidate({ id: "same", stage: "Прибыл на проект", has_medical_book: true });
    const m = calculateCandidateMetrics([dup, dup]);
    expect(m.awaiting).toBe(2);
    expect(m.medical).toBe(2);
    expect(m.awaitingPct).toBe(100); // 2/2
    expect(m.medicalPct).toBe(100);
  });

  it("does not mutate the input array or its elements", () => {
    const list = [
      makeCandidate({ id: "1", stage: "Прибыл на проект", has_medical_book: true }),
      makeCandidate({ id: "2", first_shift_at: "2026-07-05T08:00:00.000Z" }),
    ];
    const snapshot = JSON.parse(JSON.stringify(list));
    calculateCandidateMetrics(list);
    expect(list).toEqual(snapshot);
  });
});
