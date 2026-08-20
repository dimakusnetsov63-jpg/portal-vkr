import { describe, expect, it } from "vitest";
import {
  buildReviewFilters,
  defaultFilterState,
  startOfMonth,
  todayIso,
  type QualityFilterState,
} from "./qualityFilters";

function state(overrides: Partial<QualityFilterState> = {}): QualityFilterState {
  return { ...defaultFilterState(), ...overrides };
}

describe("buildReviewFilters", () => {
  it("пустые поля не уезжают в запрос", () => {
    const filters = buildReviewFilters(state({ project: "", kind: "", search: "" }));

    expect(filters.project).toBeUndefined();
    expect(filters.kind).toBeUndefined();
    expect(filters.search).toBeUndefined();
  });

  it("заполненные поля передаются как есть", () => {
    const filters = buildReviewFilters(state({ project: "Самокат", kind: "refusal" }));

    expect(filters.project).toBe("Самокат");
    expect(filters.kind).toBe("refusal");
  });

  it("поиск обрезается по краям, но пробельный запрос не фильтрует", () => {
    expect(buildReviewFilters(state({ search: "  Иванов  " })).search).toBe("Иванов");
    expect(buildReviewFilters(state({ search: "   " })).search).toBeUndefined();
  });

  it("вкладка «Проверки» не включает ни кейсы, ни архив", () => {
    const filters = buildReviewFilters(state({ tab: "reviews" }));

    expect(filters.onlyCases).toBeUndefined();
    expect(filters.showArchived).toBeUndefined();
  });

  it("вкладка «Аудиотека» показывает только отмеченные кейсы", () => {
    const filters = buildReviewFilters(state({ tab: "cases" }));

    expect(filters.onlyCases).toBe(true);
    expect(filters.showArchived).toBeUndefined();
  });

  it("вкладка «Архив» показывает только убранные из работы", () => {
    const filters = buildReviewFilters(state({ tab: "archived" }));

    expect(filters.showArchived).toBe(true);
    expect(filters.onlyCases).toBeUndefined();
  });

  it("признаки вкладок не включаются одновременно ни при какой вкладке", () => {
    // Оба сразу означали бы «архивные кейсы» — состояние, которого в
    // интерфейсе нет и которое незаметно сузило бы выдачу до пустой.
    for (const tab of ["reviews", "cases", "archived"] as const) {
      const filters = buildReviewFilters(state({ tab }));
      expect(Boolean(filters.onlyCases) && Boolean(filters.showArchived)).toBe(false);
    }
  });

  it("период переносится в запрос", () => {
    const filters = buildReviewFilters(state({ dateFrom: "2026-08-01", dateTo: "2026-08-20" }));

    expect(filters.dateFrom).toBe("2026-08-01");
    expect(filters.dateTo).toBe("2026-08-20");
  });
});

describe("период по умолчанию", () => {
  it("startOfMonth даёт первое число месяца переданной даты", () => {
    expect(startOfMonth(new Date(2026, 7, 20))).toBe("2026-08-01");
  });

  it("todayIso даёт дату без времени", () => {
    // Дата собирается из местных компонентов — тест не должен зависеть от
    // часового пояса, в котором его запускают.
    expect(todayIso(new Date(2026, 7, 20, 15, 42))).toBe("2026-08-20");
  });

  it("BUG-07: местная полночь не съезжает на вчера восточнее Гринвича", () => {
    // new Date(2026, 7, 1).toISOString() в UTC+3 даёт 2026-07-31 — ровно то,
    // из-за чего период по умолчанию начинался на день раньше.
    expect(startOfMonth(new Date(2026, 7, 1, 0, 30))).toBe("2026-08-01");
    expect(todayIso(new Date(2026, 7, 1, 0, 30))).toBe("2026-08-01");
  });

  it("состояние по умолчанию открывает текущий месяц на вкладке проверок", () => {
    const initial = defaultFilterState();

    expect(initial.tab).toBe("reviews");
    expect(initial.dateFrom).toBe(startOfMonth());
    expect(initial.project).toBe("");
  });
});
