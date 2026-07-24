import { describe, expect, it } from "vitest";
import { currentWeekTargets, nextDayTarget, next7DaysTargets, repeatWeekRows, untilDateTargets } from "./demandCopy";

// 2026-07-24 is a Friday; its Mon-Sun week is 2026-07-20..2026-07-26.

describe("nextDayTarget", () => {
  it("returns the single following day", () => {
    expect(nextDayTarget("2026-07-24")).toEqual(["2026-07-25"]);
  });
});

describe("next7DaysTargets", () => {
  it("returns the 7 days right after the given date", () => {
    expect(next7DaysTargets("2026-07-24")).toEqual([
      "2026-07-25",
      "2026-07-26",
      "2026-07-27",
      "2026-07-28",
      "2026-07-29",
      "2026-07-30",
      "2026-07-31",
    ]);
  });
});

describe("untilDateTargets", () => {
  it("returns every day strictly after `date` up to and including `until`", () => {
    expect(untilDateTargets("2026-07-24", "2026-07-26")).toEqual(["2026-07-25", "2026-07-26"]);
  });

  it("returns an empty array when `until` equals `date`", () => {
    expect(untilDateTargets("2026-07-24", "2026-07-24")).toEqual([]);
  });

  it("returns an empty array when `until` is before `date`", () => {
    expect(untilDateTargets("2026-07-24", "2026-07-20")).toEqual([]);
  });
});

describe("currentWeekTargets", () => {
  it("returns the rest of the Mon-Sun week, excluding the given date", () => {
    expect(currentWeekTargets("2026-07-24")).toEqual([
      "2026-07-20",
      "2026-07-21",
      "2026-07-22",
      "2026-07-23",
      "2026-07-25",
      "2026-07-26",
    ]);
  });
});

describe("repeatWeekRows", () => {
  it("shifts every cell within the given week 7 days forward", () => {
    const cells = { "2026-07-20": 5, "2026-07-22": 3, "2026-08-05": 9 };
    expect(repeatWeekRows(cells, "2026-07-20")).toEqual(
      expect.arrayContaining([
        { demand_date: "2026-07-27", planned_count: 5 },
        { demand_date: "2026-07-29", planned_count: 3 },
      ]),
    );
  });

  it("ignores cells outside the given week", () => {
    const cells = { "2026-07-20": 5, "2026-08-05": 9 };
    const rows = repeatWeekRows(cells, "2026-07-20");
    expect(rows).toHaveLength(1);
    expect(rows.some((r) => r.demand_date === "2026-08-12")).toBe(false);
  });

  it("returns an empty array when the city has no cells in that week", () => {
    expect(repeatWeekRows({}, "2026-07-20")).toEqual([]);
  });
});
