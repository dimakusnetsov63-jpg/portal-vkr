import { describe, expect, it } from "vitest";
import type { RateCardRow, RateRow } from "@/lib/supabase/rates.types";
import {
  calculateRateMetrics,
  incomePerMonth,
  incomePerShift,
  incomePerWeek,
  joinRatesWithCards,
  shiftsPerMonth,
  shiftsPerWeek,
  type RateWithCard,
} from "./rateMetrics";

function makeCard(overrides: Partial<RateCardRow> = {}): RateCardRow {
  return {
    id: "card-1",
    project: "Самокат",
    city: "Москва",
    legal_entity: "Ракета",
    payroll_banks: [],
    bonuses: null,
    promotions: null,
    surcharges: null,
    hiring_conditions: null,
    notes: null,
    manager: null,
    office_status: "unknown",
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    created_by: null,
    created_by_login: null,
    updated_by: null,
    updated_by_login: null,
    ...overrides,
  };
}

function makeRate(overrides: Partial<RateRow> = {}): RateRow {
  return {
    id: "rate-1",
    rate_card_id: "card-1",
    position: "вело-курьер",
    unit: "hour",
    rate_hour: 100,
    rate_hour_priority: null,
    rate_piece: null,
    pieces_per_shift: null,
    rate_shift: null,
    shift_hours: 12,
    surcharge_per_shift: null,
    schedule: null,
    extras: [],
    comment: null,
    sort_order: 0,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    created_by: null,
    created_by_login: null,
    updated_by: null,
    updated_by_login: null,
    ...overrides,
  };
}

describe("joinRatesWithCards", () => {
  it("joins rates to their card by rate_card_id", () => {
    const cards = [makeCard({ id: "card-1" }), makeCard({ id: "card-2", city: "Казань" })];
    const rates = [makeRate({ id: "r1", rate_card_id: "card-1" }), makeRate({ id: "r2", rate_card_id: "card-2" })];
    const joined = joinRatesWithCards(rates, cards);
    expect(joined).toHaveLength(2);
    expect(joined[0].card.id).toBe("card-1");
    expect(joined[1].card.city).toBe("Казань");
  });

  it("drops a rate whose card is missing (e.g. not yet synced after a cascade delete)", () => {
    const cards = [makeCard({ id: "card-1" })];
    const rates = [makeRate({ id: "r1", rate_card_id: "card-1" }), makeRate({ id: "r2", rate_card_id: "card-missing" })];
    expect(joinRatesWithCards(rates, cards).map((x) => x.rate.id)).toEqual(["r1"]);
  });
});

describe("shiftsPerWeek / shiftsPerMonth", () => {
  it("maps regular schedules to an average shift count", () => {
    expect(shiftsPerWeek("2/2")).toBe(3.5);
    expect(shiftsPerWeek("5/2")).toBe(5);
    expect(shiftsPerWeek("6/1")).toBe(6);
    expect(shiftsPerWeek("7/0")).toBe(7);
  });

  it("is null for schedules without a regular cadence", () => {
    expect(shiftsPerWeek("flexible")).toBeNull();
    expect(shiftsPerWeek("parttime")).toBeNull();
    expect(shiftsPerWeek(null)).toBeNull();
  });

  it("scales weekly shifts to a monthly average and rounds to a whole shift", () => {
    expect(shiftsPerMonth("6/1")).toBe(Math.round(6 * (365.25 / 12 / 7)));
    expect(shiftsPerMonth("flexible")).toBeNull();
  });
});

describe("incomePerShift", () => {
  it("sums hourly rate * hours, piece rate * pieces, flat shift pay and surcharge", () => {
    const rate = makeRate({
      rate_hour: 100,
      shift_hours: 12,
      rate_piece: 40,
      pieces_per_shift: 5,
      rate_shift: 200,
      surcharge_per_shift: 50,
    });
    // 100*12 + 40*5 + 200 + 50 = 1200 + 200 + 200 + 50 = 1650
    expect(incomePerShift(rate)).toBe(1650);
  });

  it("treats null components as zero, never NaN", () => {
    const rate = makeRate({ rate_hour: null, rate_piece: null, rate_shift: null, surcharge_per_shift: null });
    expect(incomePerShift(rate)).toBe(0);
  });

  it("does not fold rate_hour_priority into the total — it is an alternative rate, not an add-on", () => {
    const withPriority = makeRate({ rate_hour: 100, shift_hours: 12, rate_hour_priority: 999 });
    const withoutPriority = makeRate({ rate_hour: 100, shift_hours: 12, rate_hour_priority: null });
    expect(incomePerShift(withPriority)).toBe(incomePerShift(withoutPriority));
  });
});

describe("incomePerWeek / incomePerMonth", () => {
  it("is null when the schedule has no regular cadence", () => {
    expect(incomePerWeek(makeRate({ schedule: "flexible" }))).toBeNull();
    expect(incomePerWeek(makeRate({ schedule: null }))).toBeNull();
    expect(incomePerMonth(makeRate({ schedule: "parttime" }))).toBeNull();
  });

  it("multiplies the per-shift income by the schedule's shift count", () => {
    const rate = makeRate({ rate_hour: 100, shift_hours: 12, schedule: "5/2" });
    expect(incomePerWeek(rate)).toBe(incomePerShift(rate) * 5);
  });
});

describe("calculateRateMetrics", () => {
  it("returns zeros for an empty set, never NaN", () => {
    const m = calculateRateMetrics([]);
    expect(m).toEqual({
      totalRates: 0,
      totalCards: 0,
      projectsCount: 0,
      citiesCount: 0,
      positionsCount: 0,
      avgHourRate: 0,
      avgShiftIncome: 0,
      avgMonthIncome: 0,
    });
    for (const v of Object.values(m)) expect(Number.isNaN(v)).toBe(false);
  });

  it("counts distinct projects/cities/positions/cards and averages hour rate only over rows where it is set", () => {
    const rows: RateWithCard[] = [
      { card: makeCard({ id: "c1", project: "Самокат", city: "Москва" }), rate: makeRate({ id: "r1", rate_card_id: "c1", position: "вело-курьер", rate_hour: 100 }) },
      { card: makeCard({ id: "c1", project: "Самокат", city: "Москва" }), rate: makeRate({ id: "r2", rate_card_id: "c1", position: "пеший-курьер", rate_hour: 200 }) },
      { card: makeCard({ id: "c2", project: "Купер", city: "Казань" }), rate: makeRate({ id: "r3", rate_card_id: "c2", position: "сборщик", rate_hour: null }) },
    ];
    const m = calculateRateMetrics(rows);
    expect(m.totalRates).toBe(3);
    expect(m.totalCards).toBe(2);
    expect(m.projectsCount).toBe(2);
    expect(m.citiesCount).toBe(2);
    expect(m.positionsCount).toBe(3);
    expect(m.avgHourRate).toBe(150); // (100 + 200) / 2, the null row is excluded
  });
});
