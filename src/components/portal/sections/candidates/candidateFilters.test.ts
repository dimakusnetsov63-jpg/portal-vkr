import { describe, expect, it } from "vitest";
import type { Candidate } from "@/lib/supabase/candidates.types";
import { filterCandidates, type CandidateFilters } from "./candidateFilters";

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

const NO_FILTERS: CandidateFilters = { search: "", project: "", stage: "", showArchived: false };

describe("filterCandidates", () => {
  it("returns all (non-archived) candidates when no filters are set", () => {
    const list = [
      makeCandidate({ id: "1" }),
      makeCandidate({ id: "2" }),
      makeCandidate({ id: "3" }),
    ];
    const result = filterCandidates(list, NO_FILTERS);
    expect(result).toHaveLength(3);
    expect(result.map((c) => c.id)).toEqual(["1", "2", "3"]);
  });

  it("searches by full name (case-insensitive, partial)", () => {
    const list = [
      makeCandidate({ id: "1", full_name: "Пётр Смирнов" }),
      makeCandidate({ id: "2", full_name: "Иван Иванов" }),
    ];
    const result = filterCandidates(list, { ...NO_FILTERS, search: "смирн" });
    expect(result.map((c) => c.id)).toEqual(["1"]);
  });

  it("searches by phone", () => {
    const list = [
      makeCandidate({ id: "1", phone: "+7 900 111-22-33" }),
      makeCandidate({ id: "2", phone: "+7 900 999-88-77" }),
    ];
    const result = filterCandidates(list, { ...NO_FILTERS, search: "111-22" });
    expect(result.map((c) => c.id)).toEqual(["1"]);
  });

  it("searches by external_id and city (other supported fields)", () => {
    const list = [
      makeCandidate({ id: "1", external_id: "EXT-0001", city: "Москва" }),
      makeCandidate({ id: "2", external_id: "EXT-0002", city: "Казань" }),
      makeCandidate({ id: "3", telegram_tag: "@vasya", max_tag: "vasya_max" }),
    ];
    expect(filterCandidates(list, { ...NO_FILTERS, search: "ext-0002" }).map((c) => c.id)).toEqual(["2"]);
    expect(filterCandidates(list, { ...NO_FILTERS, search: "казань" }).map((c) => c.id)).toEqual(["2"]);
    expect(filterCandidates(list, { ...NO_FILTERS, search: "@vasya" }).map((c) => c.id)).toEqual(["3"]);
  });

  it("filters by project (empty project string means all)", () => {
    const list = [
      makeCandidate({ id: "1", project: "Самокат" }),
      makeCandidate({ id: "2", project: "Купер" }),
    ];
    expect(filterCandidates(list, { ...NO_FILTERS, project: "Купер" }).map((c) => c.id)).toEqual(["2"]);
    expect(filterCandidates(list, NO_FILTERS)).toHaveLength(2);
  });

  it("filters by stage (empty stage string means all)", () => {
    const list = [
      makeCandidate({ id: "1", stage: "Прибыл на проект" }),
      makeCandidate({ id: "2", stage: "Завершил вахту" }),
      makeCandidate({ id: "3", stage: null }),
    ];
    expect(filterCandidates(list, { ...NO_FILTERS, stage: "Завершил вахту" }).map((c) => c.id)).toEqual(["2"]);
    expect(filterCandidates(list, NO_FILTERS)).toHaveLength(3);
  });

  it("hides archived candidates by default", () => {
    const list = [
      makeCandidate({ id: "1" }),
      makeCandidate({ id: "2", archived_at: "2026-07-10T00:00:00.000Z" }),
    ];
    const result = filterCandidates(list, NO_FILTERS);
    expect(result.map((c) => c.id)).toEqual(["1"]);
  });

  it("shows archived candidates when showArchived is on", () => {
    const list = [
      makeCandidate({ id: "1" }),
      makeCandidate({ id: "2", archived_at: "2026-07-10T00:00:00.000Z" }),
    ];
    const result = filterCandidates(list, { ...NO_FILTERS, showArchived: true });
    expect(result.map((c) => c.id)).toEqual(["1", "2"]);
  });

  it("applies multiple filters at once (project + stage + search + archive)", () => {
    const list = [
      makeCandidate({ id: "1", project: "Самокат", stage: "Завершил вахту", full_name: "Анна Кот" }),
      makeCandidate({ id: "2", project: "Самокат", stage: "Завершил вахту", full_name: "Борис Пёс" }),
      makeCandidate({ id: "3", project: "Купер", stage: "Завершил вахту", full_name: "Анна Кот" }),
      makeCandidate({
        id: "4",
        project: "Самокат",
        stage: "Завершил вахту",
        full_name: "Анна Кот",
        archived_at: "2026-07-10T00:00:00.000Z",
      }),
    ];
    const result = filterCandidates(list, {
      search: "анна",
      project: "Самокат",
      stage: "Завершил вахту",
      showArchived: false,
    });
    expect(result.map((c) => c.id)).toEqual(["1"]);
  });

  it("returns an empty array when nothing matches", () => {
    const list = [makeCandidate({ id: "1", full_name: "Иван Иванов" })];
    const result = filterCandidates(list, { ...NO_FILTERS, search: "несуществующее" });
    expect(result).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const list = [
      makeCandidate({ id: "1", archived_at: "2026-07-10T00:00:00.000Z" }),
      makeCandidate({ id: "2" }),
    ];
    const snapshot = [...list];
    filterCandidates(list, { ...NO_FILTERS, showArchived: true, search: "иван" });
    expect(list).toHaveLength(2);
    expect(list).toEqual(snapshot);
  });
});
