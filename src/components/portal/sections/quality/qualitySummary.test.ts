import { describe, expect, it } from "vitest";
import type { QualityGroupReportRow, QualityReportRow } from "@/lib/supabase/quality.types";
import { blockColumns, buildSummary, summaryTotals } from "./qualitySummary";

function report(overrides: Partial<QualityReportRow>): QualityReportRow {
  return {
    employee_name: "Иванов",
    project: "Самокат",
    reviews_count: 1,
    scored_count: 1,
    avg_total: 100,
    cases_count: 0,
    critical_count: 0,
    ...overrides,
  } as QualityReportRow;
}

function group(overrides: Partial<QualityGroupReportRow>): QualityGroupReportRow {
  return {
    employee_name: "Иванов",
    group_id: Math.random().toString(36).slice(2),
    group_title: "Презентация вакансии",
    group_sort_order: 3,
    counts_in_total: true,
    reviews_count: 1,
    scored_count: 1,
    avg_percent: 100,
    ...overrides,
  } as QualityGroupReportRow;
}

describe("buildSummary", () => {
  it("блоки складываются по названию, а не по идентификатору", () => {
    // У каждого проекта свой шаблон, и «Презентация вакансии» у двух
    // проектов — разные строки с разными id. По id сотрудник, работающий на
    // двух проектах, оказался бы разорван пополам.
    const rows = buildSummary({
      callReport: [],
      refusalReport: [],
      groups: [
        group({ group_id: "a", avg_percent: 100, scored_count: 1 }),
        group({ group_id: "b", avg_percent: 50, scored_count: 1 }),
      ],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].byBlock["Презентация вакансии"]).toBe(75);
  });

  it("процент блока взвешивается на число оценённых проверок", () => {
    const rows = buildSummary({
      callReport: [],
      refusalReport: [],
      groups: [
        group({ group_id: "a", avg_percent: 100, scored_count: 9 }),
        group({ group_id: "b", avg_percent: 50, scored_count: 1 }),
      ],
    });

    expect(rows[0].byBlock["Презентация вакансии"]).toBe(95);
  });

  it("общий процент взвешивается на scored_count, а не на reviews_count", () => {
    // BUG-03 аудита: avg_total база считает без строк с пустым итогом, и
    // взвешивать его на reviews_count значит уехать, как только появится
    // хоть одна проверка без итога.
    const rows = buildSummary({
      callReport: [
        report({ avg_total: 100, scored_count: 1, reviews_count: 10 }),
        report({ project: "Купер", avg_total: 50, scored_count: 1, reviews_count: 1 }),
      ],
      refusalReport: [],
      groups: [],
    });

    expect(rows[0].overall).toBe(75);
  });

  it("проверка без итога не входит в средний ни значением, ни весом", () => {
    const rows = buildSummary({
      callReport: [
        report({ avg_total: 80, scored_count: 2 }),
        report({ project: "Купер", avg_total: null, scored_count: 0, reviews_count: 3 }),
      ],
      refusalReport: [],
      groups: [],
    });

    expect(rows[0].overall).toBe(80);
    // В счётчике проверок такая строка при этом учтена: она была.
    expect(rows[0].callReviews).toBe(4);
  });

  it("прослушки и самоотказы считаются раздельно — команда просила именно так", () => {
    const rows = buildSummary({
      callReport: [report({ reviews_count: 7 })],
      refusalReport: [report({ reviews_count: 12 })],
      groups: [],
    });

    expect(rows[0].callReviews).toBe(7);
    expect(rows[0].refusalReviews).toBe(12);
  });

  it("сотрудник только с самоотказами не теряется из сводки", () => {
    const rows = buildSummary({
      callReport: [],
      refusalReport: [report({ employee_name: "Петрова", reviews_count: 4 })],
      groups: [],
    });

    expect(rows.map((r) => r.employee)).toEqual(["Петрова"]);
    expect(rows[0].callReviews).toBe(0);
    expect(rows[0].overall).toBeNull();
  });

  it("нет данных — нет строк, а не строка с нулями", () => {
    expect(buildSummary({ callReport: [], refusalReport: [], groups: [] })).toEqual([]);
  });

  it("блок без единого числа даёт прочерк, а не ноль", () => {
    // Ноль означал бы «всё провалено»; блок мог просто не оцениваться.
    const rows = buildSummary({
      callReport: [],
      refusalReport: [],
      groups: [group({ avg_percent: null, scored_count: 0 })],
    });

    expect(rows[0].byBlock["Презентация вакансии"]).toBeNull();
  });

  it("кейсы и критические ошибки суммируются по обоим видам проверки", () => {
    const rows = buildSummary({
      callReport: [report({ cases_count: 2, critical_count: 1 })],
      refusalReport: [report({ cases_count: 3, critical_count: 4 })],
      groups: [],
    });

    expect(rows[0].cases).toBe(5);
    expect(rows[0].critical).toBe(5);
  });

  it("сотрудники идут по алфавиту — сводку читают, ища человека", () => {
    const rows = buildSummary({
      callReport: [report({ employee_name: "Яковлев" }), report({ employee_name: "Абрамов" }), report({ employee_name: "Миронов" })],
      refusalReport: [],
      groups: [],
    });

    expect(rows.map((r) => r.employee)).toEqual(["Абрамов", "Миронов", "Яковлев"]);
  });
});

describe("blockColumns", () => {
  it("порядок берётся из шаблона, а не из порядка строк в ответе", () => {
    const columns = blockColumns([
      group({ group_title: "Завершение звонка", group_sort_order: 9 }),
      group({ group_title: "Установление контакта", group_sort_order: 1 }),
      group({ group_title: "Возражения", group_sort_order: 7, counts_in_total: false }),
    ]);

    expect(columns.map((c) => c.title)).toEqual(["Установление контакта", "Возражения", "Завершение звонка"]);
  });

  it("у одноимённых блоков берётся наименьший порядок", () => {
    // Один и тот же блок может стоять в разных шаблонах на разных местах.
    const columns = blockColumns([
      group({ group_title: "Возражения", group_sort_order: 7 }),
      group({ group_title: "Возражения", group_sort_order: 5 }),
      group({ group_title: "Итог", group_sort_order: 6 }),
    ]);

    expect(columns.map((c) => c.title)).toEqual(["Возражения", "Итог"]);
  });

  it("признак «входит в итог» сохраняется — блок возражений в итог не идёт", () => {
    const columns = blockColumns([group({ group_title: "Возражения", counts_in_total: false })]);

    expect(columns[0].countsInTotal).toBe(false);
  });

  it("состав берётся из данных: новый блок в шаблоне попадёт в сводку сам", () => {
    const columns = blockColumns([group({ group_title: "Совсем новый блок", group_sort_order: 4 })]);

    expect(columns.map((c) => c.title)).toEqual(["Совсем новый блок"]);
  });
});

describe("summaryTotals", () => {
  const blocks = [{ title: "Презентация вакансии" }];

  it("итог по всем взвешивается на число проверок, а не по одному голосу на сотрудника", () => {
    // Иначе человек с двумя прослушками влиял бы на общий процент так же,
    // как человек с сорока.
    const rows = buildSummary({
      callReport: [
        report({ employee_name: "Много", avg_total: 100, scored_count: 9, reviews_count: 9 }),
        report({ employee_name: "Мало", avg_total: 50, scored_count: 1, reviews_count: 1 }),
      ],
      refusalReport: [],
      groups: [],
    });

    expect(summaryTotals(rows, blocks).overall).toBe(95);
  });

  it("счётчики складываются, виды остаются раздельными", () => {
    const rows = buildSummary({
      callReport: [report({ employee_name: "А", reviews_count: 3, cases_count: 1 })],
      refusalReport: [report({ employee_name: "Б", reviews_count: 5, critical_count: 2 })],
      groups: [],
    });
    const total = summaryTotals(rows, blocks);

    expect(total.callReviews).toBe(3);
    expect(total.refusalReviews).toBe(5);
    expect(total.cases).toBe(1);
    expect(total.critical).toBe(2);
  });

  it("пустая сводка даёт прочерки, а не нули и не NaN", () => {
    const total = summaryTotals([], blocks);

    expect(total.overall).toBeNull();
    expect(total.byBlock["Презентация вакансии"]).toBeNull();
    expect(total.callReviews).toBe(0);
  });
});
