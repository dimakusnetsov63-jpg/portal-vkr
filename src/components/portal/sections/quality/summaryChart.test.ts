import { describe, expect, it } from "vitest";
import type { QualityReportRow } from "@/lib/supabase/quality.types";
import type { EmployeeSummary } from "./qualitySummary";
import {
  barWidth,
  employeeBars,
  employeeRanking,
  projectBars,
  scoreDistribution,
  teamBars,
  weakestFirst,
  type ChartBar,
} from "./summaryChart";

function summary(overrides: Partial<EmployeeSummary> = {}): EmployeeSummary {
  return {
    employee: "Иванов",
    callReviews: 5,
    refusalReviews: 0,
    overall: 80,
    cases: 0,
    critical: 0,
    byBlock: {},
    ...overrides,
  };
}

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

const blocks = [
  { title: "Установление контакта", countsInTotal: true },
  { title: "Возражения", countsInTotal: false },
];

describe("employeeBars", () => {
  it("считает отставание от команды", () => {
    const bars = employeeBars(
      summary({ byBlock: { "Установление контакта": 70, Возражения: 90 } }),
      summary({ employee: "Все", byBlock: { "Установление контакта": 85, Возражения: 60 } }),
      blocks,
    );

    expect(bars[0].delta).toBe(-15);
    expect(bars[1].delta).toBe(30);
  });

  it("без среднего по команде сравнения нет, а не ноль", () => {
    // «−78» против пустоты — не отставание, а бессмыслица.
    const bars = employeeBars(summary({ byBlock: { "Установление контакта": 78 } }), null, blocks);

    expect(bars[0].value).toBe(78);
    expect(bars[0].baseline).toBeNull();
    expect(bars[0].delta).toBeNull();
  });

  it("неоценённый блок сотрудника не сравнивается", () => {
    const bars = employeeBars(summary(), summary({ byBlock: { "Установление контакта": 85 } }), blocks);

    expect(bars[0].value).toBeNull();
    expect(bars[0].baseline).toBe(85);
    expect(bars[0].delta).toBeNull();
  });

  it("пометка «не в итог» доходит до графика", () => {
    const bars = teamBars(summary(), blocks);

    expect(bars[0].note).toBeUndefined();
    expect(bars[1].note).toBe("не в итог");
  });

  it("разница округляется до сотых, как и сами проценты", () => {
    const bars = employeeBars(
      summary({ byBlock: { "Установление контакта": 66.67 } }),
      summary({ byBlock: { "Установление контакта": 33.33 } }),
      blocks,
    );

    expect(bars[0].delta).toBe(33.34);
  });
});

describe("employeeRanking", () => {
  it("сильные сверху", () => {
    const bars = employeeRanking(
      [
        summary({ employee: "Слабый", overall: 60 }),
        summary({ employee: "Сильный", overall: 95 }),
        summary({ employee: "Средний", overall: 78 }),
      ],
      null,
    );

    expect(bars.map((b) => b.label)).toEqual(["Сильный", "Средний", "Слабый"]);
  });

  it("рядом с процентом стоит число проверок — без него это доска позора", () => {
    // 100% по двум прослушкам убедительнее 85% по сорока только на глаз.
    const bars = employeeRanking([summary({ callReviews: 2, overall: 100 })], null);

    expect(bars[0].note).toBe("2 проверки");
  });

  it("склонение числа проверок русское, а не «2 проверок»", () => {
    const one = employeeRanking([summary({ callReviews: 1 })], null)[0].note;
    const few = employeeRanking([summary({ callReviews: 3 })], null)[0].note;
    const many = employeeRanking([summary({ callReviews: 11 })], null)[0].note;
    const edge = employeeRanking([summary({ callReviews: 21 })], null)[0].note;

    expect([one, few, many, edge]).toEqual(["1 проверка", "3 проверки", "11 проверок", "21 проверка"]);
  });

  it("сотрудник без прослушек КЦ в рейтинг не попадает", () => {
    // Общий процент считается по ним; пустая полоса ничего не сообщает.
    const bars = employeeRanking([summary({ employee: "Только самоотказы", callReviews: 0, refusalReviews: 9 })], null);

    expect(bars).toEqual([]);
  });

  it("сравнение с командой считается, когда есть с чем", () => {
    const bars = employeeRanking([summary({ overall: 90 })], summary({ employee: "Все", overall: 82 }));

    expect(bars[0].delta).toBe(8);
  });
});

describe("projectBars", () => {
  it("проценты проекта взвешиваются на число оценённых проверок", () => {
    const bars = projectBars([
      report({ project: "Самокат", avg_total: 100, scored_count: 9, reviews_count: 9 }),
      report({ project: "Самокат", employee_name: "Второй", avg_total: 50, scored_count: 1, reviews_count: 1 }),
    ]);

    expect(bars[0].value).toBe(95);
    expect(bars[0].note).toBe("10 проверок");
  });

  it("проекты идут по убыванию процента", () => {
    const bars = projectBars([
      report({ project: "Слабый", avg_total: 60 }),
      report({ project: "Сильный", avg_total: 95 }),
    ]);

    expect(bars.map((b) => b.label)).toEqual(["Сильный", "Слабый"]);
  });

  it("проект без единого итога даёт прочерк, но остаётся в списке", () => {
    const bars = projectBars([report({ project: "Пустой", avg_total: null, scored_count: 0, reviews_count: 4 })]);

    expect(bars[0].value).toBeNull();
    expect(bars[0].note).toBe("4 проверки");
  });

  it("нет данных — нет столбцов", () => {
    expect(projectBars([])).toEqual([]);
  });
});

describe("scoreDistribution", () => {
  it("раскладывает сотрудников по диапазонам и считает долю", () => {
    const bars = scoreDistribution([
      summary({ employee: "а", overall: 95 }),
      summary({ employee: "б", overall: 92 }),
      summary({ employee: "в", overall: 75 }),
      summary({ employee: "г", overall: 40 }),
    ]);

    expect(bars.map((b) => [b.label, b.note])).toEqual([
      ["90–100%", "2 сотрудника"],
      ["70–90%", "1 сотрудник"],
      ["50–70%", "0 сотрудников"],
      ["ниже 50%", "1 сотрудник"],
    ]);
    expect(bars[0].value).toBe(50);
  });

  it("границы не теряют и не задваивают людей", () => {
    // Ровно 90 и ровно 70 — частый источник ошибки на единицу.
    const bars = scoreDistribution([
      summary({ employee: "а", overall: 90 }),
      summary({ employee: "б", overall: 70 }),
      summary({ employee: "в", overall: 100 }),
      summary({ employee: "г", overall: 0 }),
    ]);
    const counted = bars.reduce((sum, b) => sum + Number(b.note!.split(" ")[0]), 0);

    expect(counted).toBe(4);
    expect(bars[0].note).toBe("2 сотрудника");
    expect(bars[1].note).toBe("1 сотрудник");
    expect(bars[3].note).toBe("1 сотрудник");
  });

  it("сотрудники без итога не участвуют вовсе", () => {
    const bars = scoreDistribution([summary({ overall: null }), summary({ employee: "б", overall: 80 })]);

    expect(bars[1].value).toBe(100);
  });

  it("никого с итогом — график не рисуется", () => {
    expect(scoreDistribution([summary({ overall: null })])).toEqual([]);
    expect(scoreDistribution([])).toEqual([]);
  });
});

describe("weakestFirst", () => {
  function bar(label: string, value: number | null): ChartBar {
    return { label, value, baseline: null, delta: null };
  }

  it("слабое сверху — график отвечает на «чему учить»", () => {
    const sorted = weakestFirst([bar("А", 90), bar("Б", 40), bar("В", 70)]);

    expect(sorted.map((b) => b.label)).toEqual(["Б", "В", "А"]);
  });

  it("неоценённые уходят в конец, но не пропадают", () => {
    const sorted = weakestFirst([bar("А", null), bar("Б", 40), bar("В", null)]);

    expect(sorted.map((b) => b.label)).toEqual(["Б", "А", "В"]);
  });

  it("не мутирует исходный список", () => {
    const input = [bar("А", 90), bar("Б", 40)];
    weakestFirst(input);

    expect(input.map((b) => b.label)).toEqual(["А", "Б"]);
  });
});

describe("barWidth", () => {
  it("процент становится шириной один в один", () => {
    expect(barWidth(0)).toBe(0);
    expect(barWidth(63.5)).toBe(63.5);
    expect(barWidth(100)).toBe(100);
  });

  it("отсутствие оценки даёт нулевую ширину, а не сломанную вёрстку", () => {
    expect(barWidth(null)).toBe(0);
    expect(barWidth(Number.NaN)).toBe(0);
  });

  it("значение за границами зажимается — столбец не вылезет из дорожки", () => {
    expect(barWidth(140)).toBe(100);
    expect(barWidth(-20)).toBe(0);
  });
});
