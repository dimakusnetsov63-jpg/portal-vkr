import { describe, expect, it } from "vitest";
import type { QualityReportRow } from "@/lib/supabase/quality.types";
import { summarizeReport } from "./qualityReport";

function row(overrides: Partial<QualityReportRow> = {}): QualityReportRow {
  return {
    employee_name: "Иванов Иван",
    project: "Самокат",
    reviews_count: 1,
    scored_count: 1,
    avg_total: 100,
    cases_count: 0,
    critical_count: 0,
    ...overrides,
  };
}

describe("summarizeReport — показатели над реестром", () => {
  it("суммирует проверки, кейсы, критические ошибки и считает сотрудников", () => {
    const summary = summarizeReport([
      row({ employee_name: "Иванов Иван", reviews_count: 3, scored_count: 3, cases_count: 1 }),
      row({ employee_name: "Петров Пётр", reviews_count: 2, scored_count: 2, critical_count: 1 }),
      // Тот же человек на другом проекте — сотрудник один, строк две.
      row({ employee_name: "Иванов Иван", project: "Купер", reviews_count: 1, scored_count: 1 }),
    ]);

    expect(summary.reviews).toBe(6);
    expect(summary.employees).toBe(2);
    expect(summary.cases).toBe(1);
    expect(summary.critical).toBe(1);
  });

  it("взвешивает средний по числу оценённых проверок", () => {
    // 90% по двум проверкам и 60% по одной → (90×2 + 60×1) / 3 = 80.
    const summary = summarizeReport([
      row({ reviews_count: 2, scored_count: 2, avg_total: 90 }),
      row({ employee_name: "Петров Пётр", reviews_count: 1, scored_count: 1, avg_total: 60 }),
    ]);

    expect(summary.average).toBe(80);
    expect(summary.scored).toBe(3);
  });

  it("BUG-03: вес берётся из scored_count, а не из reviews_count", () => {
    // У первого сотрудника пять завершённых проверок, но итог дали только
    // две — остальные три «не применимо» целиком. Верный ответ:
    // (90×2 + 60×2) / 4 = 75. Взвешивание на reviews_count дало бы
    // (90×5 + 60×2) / 7 ≈ 81.43 — завышение почти на семь пунктов.
    const summary = summarizeReport([
      row({ reviews_count: 5, scored_count: 2, avg_total: 90 }),
      row({ employee_name: "Петров Пётр", reviews_count: 2, scored_count: 2, avg_total: 60 }),
    ]);

    expect(summary.average).toBe(75);
    expect(summary.reviews).toBe(7);
    expect(summary.scored).toBe(4);
  });

  it("строка без единого итога не влияет ни значением, ни весом", () => {
    const summary = summarizeReport([
      row({ reviews_count: 2, scored_count: 2, avg_total: 80 }),
      row({ employee_name: "Петров Пётр", reviews_count: 3, scored_count: 0, avg_total: null }),
    ]);

    expect(summary.average).toBe(80);
    expect(summary.reviews).toBe(5);
    expect(summary.scored).toBe(2);
  });

  it("когда ни одна проверка не дала итога — средний null, а не ноль", () => {
    const summary = summarizeReport([
      row({ reviews_count: 4, scored_count: 0, avg_total: null }),
      row({ employee_name: "Петров Пётр", reviews_count: 1, scored_count: 0, avg_total: null }),
    ]);

    expect(summary.average).toBeNull();
    expect(summary.reviews).toBe(5);
    expect(summary.scored).toBe(0);
  });

  it("пустой отчёт даёт нули и null, без NaN", () => {
    const summary = summarizeReport([]);

    expect(summary).toEqual({
      reviews: 0,
      scored: 0,
      employees: 0,
      average: null,
      cases: 0,
      critical: 0,
    });
    expect(Number.isNaN(summary.average as number)).toBe(false);
  });

  it("округляет средний до сотых, как база", () => {
    // (100×1 + 0×2) / 3 = 33.333… → 33.33
    const summary = summarizeReport([
      row({ reviews_count: 1, scored_count: 1, avg_total: 100 }),
      row({ employee_name: "Петров Пётр", reviews_count: 2, scored_count: 2, avg_total: 0 }),
    ]);

    expect(summary.average).toBe(33.33);
  });

  it("терпит строковые числа: PostgREST отдаёт bigint и numeric строками", () => {
    const summary = summarizeReport([
      {
        employee_name: "Иванов Иван",
        project: "Самокат",
        reviews_count: "4" as unknown as number,
        scored_count: "2" as unknown as number,
        avg_total: "75.50" as unknown as number,
        cases_count: "1" as unknown as number,
        critical_count: "0" as unknown as number,
      },
    ]);

    expect(summary.reviews).toBe(4);
    expect(summary.scored).toBe(2);
    expect(summary.cases).toBe(1);
    expect(summary.average).toBe(75.5);
  });
});
