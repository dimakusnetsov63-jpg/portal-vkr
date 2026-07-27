import { describe, expect, it } from "vitest";
import type { DemandGroupedProject } from "./demandAggregate";
import {
  DEMAND_COMMENT_MAX_LENGTH,
  demandRowMetaKey,
  filterGroupsByRowStatus,
  getRowMeta,
  isCommentTooLong,
  isDemandRowStatus,
  mergeRowMetaPatch,
  normalizeComment,
  type DemandRowStatus,
} from "./demandRowMeta";

describe("normalizeComment", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeComment("  город временно закрыт  ")).toBe("город временно закрыт");
  });
  it("turns an empty string into null", () => {
    expect(normalizeComment("")).toBeNull();
  });
  it("turns a whitespace-only string into null", () => {
    expect(normalizeComment("   ")).toBeNull();
  });
  it("leaves ordinary text unchanged (after trim)", () => {
    expect(normalizeComment("обычный комментарий")).toBe("обычный комментарий");
  });
});

describe("isCommentTooLong", () => {
  it("accepts exactly 2000 characters", () => {
    expect(isCommentTooLong("a".repeat(DEMAND_COMMENT_MAX_LENGTH))).toBe(false);
  });
  it("rejects 2001 characters", () => {
    expect(isCommentTooLong("a".repeat(DEMAND_COMMENT_MAX_LENGTH + 1))).toBe(true);
  });
  it("counts the trimmed length, not the raw length", () => {
    const raw = `  ${"a".repeat(DEMAND_COMMENT_MAX_LENGTH)}  `;
    expect(isCommentTooLong(raw)).toBe(false);
  });
});

describe("isDemandRowStatus", () => {
  it("accepts the three known statuses", () => {
    expect(isDemandRowStatus("active")).toBe(true);
    expect(isDemandRowStatus("paused")).toBe(true);
    expect(isDemandRowStatus("closed")).toBe(true);
  });
  it("rejects unknown values", () => {
    expect(isDemandRowStatus("archived")).toBe(false);
    expect(isDemandRowStatus("")).toBe(false);
  });
});

describe("demandRowMetaKey", () => {
  it("produces different keys for different (project, city, position) triples", () => {
    expect(demandRowMetaKey("Самокат", "Москва", "Курьер")).not.toBe(demandRowMetaKey("Купер", "Москва", "Курьер"));
    expect(demandRowMetaKey("Самокат", "Москва", "Курьер")).not.toBe(demandRowMetaKey("Самокат", "Москва", "Кассир"));
  });
  it("does not collide when a delimiter-joined string would (boundary shifts between fields)", () => {
    expect(demandRowMetaKey("AB", "C", "D")).not.toBe(demandRowMetaKey("A", "BC", "D"));
    expect(demandRowMetaKey("A", "B", "CD")).not.toBe(demandRowMetaKey("A", "BC", "D"));
  });
  it("is stable for the same inputs", () => {
    expect(demandRowMetaKey("Самокат", "Москва", "Курьер")).toBe(demandRowMetaKey("Самокат", "Москва", "Курьер"));
  });
});

describe("getRowMeta", () => {
  const metaList = [
    { project: "Самокат", city: "Москва", position: "Курьер", status: "paused", comment: "temporarily on hold" },
    { project: "Купер", city: "Казань", position: "Кассир", status: "bogus-status", comment: null },
  ];

  it("returns active + null when there is no record", () => {
    expect(getRowMeta(metaList, "Самокат", "Казань", "Курьер")).toEqual({ status: "active", comment: null });
  });

  it("returns the stored status and comment when a record exists", () => {
    expect(getRowMeta(metaList, "Самокат", "Москва", "Курьер")).toEqual({
      status: "paused",
      comment: "temporarily on hold",
    });
  });

  it("distinguishes rows that differ only by position", () => {
    expect(getRowMeta(metaList, "Самокат", "Москва", "Кассир")).toEqual({ status: "active", comment: null });
  });

  it("falls back to active for a corrupted/unknown status value in the data", () => {
    expect(getRowMeta(metaList, "Купер", "Казань", "Кассир").status).toBe("active");
  });
});

describe("mergeRowMetaPatch", () => {
  it("updating only status leaves the existing comment untouched", () => {
    const existing = { status: "active" as DemandRowStatus, comment: "существующий комментарий" };
    expect(mergeRowMetaPatch(existing, { status: "paused" })).toEqual({
      status: "paused",
      comment: "существующий комментарий",
    });
  });

  it("updating only comment leaves the existing status untouched", () => {
    const existing = { status: "closed" as DemandRowStatus, comment: null };
    expect(mergeRowMetaPatch(existing, { comment: "новый комментарий" })).toEqual({
      status: "closed",
      comment: "новый комментарий",
    });
  });

  it("falls back to defaults (active / null) for fields not covered by the patch when there is no existing row", () => {
    expect(mergeRowMetaPatch(undefined, { status: "paused" })).toEqual({ status: "paused", comment: null });
    expect(mergeRowMetaPatch(undefined, { comment: "первый комментарий" })).toEqual({
      status: "active",
      comment: "первый комментарий",
    });
  });

  it("an explicit null comment in the patch clears the comment (not treated as absent)", () => {
    const existing = { status: "active" as DemandRowStatus, comment: "было" };
    expect(mergeRowMetaPatch(existing, { comment: null })).toEqual({ status: "active", comment: null });
  });
});

describe("filterGroupsByRowStatus", () => {
  const metaList = [
    { project: "Самокат", city: "Москва", position: "Курьер", status: "active", comment: null },
    { project: "Самокат", city: "Казань", position: "Курьер", status: "paused", comment: null },
    { project: "Самокат", city: "Москва", position: "Кассир", status: "closed", comment: null },
    { project: "Купер", city: "Москва", position: "Курьер", status: "closed", comment: null },
  ];
  const grouped: DemandGroupedProject[] = [
    {
      project: "Самокат",
      cities: [
        { city: "Москва", positions: ["Курьер", "Кассир"] },
        { city: "Казань", positions: ["Курьер"] },
      ],
    },
    { project: "Купер", cities: [{ city: "Москва", positions: ["Курьер"] }] },
  ];

  it("returns everything unfiltered when no row status is selected", () => {
    expect(filterGroupsByRowStatus(grouped, metaList, "")).toEqual(grouped);
  });

  it("keeps only positions whose row status matches", () => {
    expect(filterGroupsByRowStatus(grouped, metaList, "paused")).toEqual([
      { project: "Самокат", cities: [{ city: "Казань", positions: ["Курьер"] }] },
    ]);
  });

  it("keeps only the matching position within a city, dropping the rest", () => {
    expect(filterGroupsByRowStatus(grouped, metaList, "closed")).toEqual([
      { project: "Самокат", cities: [{ city: "Москва", positions: ["Кассир"] }] },
      { project: "Купер", cities: [{ city: "Москва", positions: ["Курьер"] }] },
    ]);
  });

  it("drops a project entirely when none of its positions match", () => {
    const result = filterGroupsByRowStatus(grouped, metaList, "closed");
    expect(result.some((g) => g.project === "Самокат" && g.cities.some((c) => c.city === "Казань"))).toBe(false);
  });

  it("treats a position with no metadata as active", () => {
    const noMeta: DemandGroupedProject[] = [{ project: "Самокат", cities: [{ city: "Уфа", positions: ["Курьер"] }] }];
    expect(filterGroupsByRowStatus(noMeta, [], "active")).toEqual(noMeta);
    expect(filterGroupsByRowStatus(noMeta, [], "paused")).toEqual([]);
  });
});
