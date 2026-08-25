import { describe, expect, it } from "vitest";
import type { QualityBucketRow, QualityMonthRow, QualityObjectionRow, QualityReportRow } from "@/lib/supabase/quality.types";
import type { EmployeeSummary } from "./qualitySummary";
import {
  areaPath,
  barWidth,
  distributionBars,
  employeeBars,
  employeeRanking,
  objectionBars,
  projectBars,
  smoothPath,
  teamBars,
  trendSeries,
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

describe("trendSeries", () => {
  function month(overrides: Partial<QualityMonthRow>): QualityMonthRow {
    return { month: "2026-06-01", kind: "call", reviews_count: 10, scored_count: 10, avg_total: 80, ...overrides };
  }

  it("виды не складываются в одну линию", () => {
    // У прослушки КЦ средний около 83%, у самоотказов около 56%: их
    // полусумма не описывает ни то ни другое.
    const series = trendSeries(
      [month({ kind: "call", avg_total: 83 }), month({ kind: "refusal", avg_total: 56 })],
      { call: "Прослушка КЦ", refusal: "Самоотказы" },
    );

    expect(series.map((s) => s.label)).toEqual(["Прослушка КЦ", "Самоотказы"]);
    expect(series[0].points[0].value).toBe(83);
    expect(series[1].points[0].value).toBe(56);
  });

  it("месяцы выравниваются по всем рядам", () => {
    // Иначе линии разъедутся по горизонтали и сравнивать их станет нельзя.
    const series = trendSeries(
      [
        month({ month: "2026-05-01", kind: "call" }),
        month({ month: "2026-06-01", kind: "call" }),
        month({ month: "2026-06-01", kind: "refusal" }),
      ],
      {},
    );

    expect(series[0].points.map((p) => p.month)).toEqual(["2026-05-01", "2026-06-01"]);
    expect(series[1].points.map((p) => p.month)).toEqual(["2026-05-01", "2026-06-01"]);
    // В мае самоотказов не было — точка есть, но пустая.
    expect(series[1].points[0].value).toBeNull();
    expect(series[1].points[0].reviews).toBe(0);
  });

  it("месяцы идут по возрастанию, как бы ни пришли из базы", () => {
    const series = trendSeries(
      [month({ month: "2026-07-01" }), month({ month: "2026-04-01" }), month({ month: "2026-06-01" })],
      {},
    );

    expect(series[0].points.map((p) => p.month)).toEqual(["2026-04-01", "2026-06-01", "2026-07-01"]);
  });

  it("подпись месяца — русская и короткая", () => {
    const series = trendSeries([month({ month: "2026-08-01" })], {});

    expect(series[0].points[0].label).toBe("авг 26");
  });

  it("месяц без итога даёт пустую точку, а не ноль", () => {
    const series = trendSeries([month({ avg_total: null, scored_count: 0, reviews_count: 3 })], {});

    expect(series[0].points[0].value).toBeNull();
    expect(series[0].points[0].reviews).toBe(3);
  });

  it("нет данных — нет рядов", () => {
    expect(trendSeries([], {})).toEqual([]);
  });
});

describe("distributionBars", () => {
  function bucket(overrides: Partial<QualityBucketRow>): QualityBucketRow {
    return { bucket: "90–100%", bucket_order: 1, reviews_count: 0, ...overrides };
  }

  it("длина столбца — доля проверок, а не процент качества", () => {
    const bars = distributionBars([
      bucket({ bucket: "90–100%", bucket_order: 1, reviews_count: 30 }),
      bucket({ bucket: "70–90%", bucket_order: 2, reviews_count: 70 }),
    ]);

    expect(bars[0].value).toBe(30);
    expect(bars[1].value).toBe(70);
  });

  it("порядок диапазонов задаёт база и его нельзя пересортировать", () => {
    const bars = distributionBars([
      bucket({ bucket: "ниже 50%", bucket_order: 4, reviews_count: 90 }),
      bucket({ bucket: "90–100%", bucket_order: 1, reviews_count: 10 }),
    ]);

    expect(bars.map((b) => b.label)).toEqual(["90–100%", "ниже 50%"]);
  });

  it("пустой диапазон остаётся в графике: ноль честнее отсутствия", () => {
    const bars = distributionBars([
      bucket({ bucket: "90–100%", bucket_order: 1, reviews_count: 5 }),
      bucket({ bucket: "50–70%", bucket_order: 3, reviews_count: 0 }),
    ]);

    expect(bars).toHaveLength(2);
    expect(bars[1].note).toBe("0 проверок");
    expect(bars[1].value).toBe(0);
  });

  it("ни одной проверки — графика нет вовсе", () => {
    expect(distributionBars([bucket({ reviews_count: 0 })])).toEqual([]);
    expect(distributionBars([])).toEqual([]);
  });
});

describe("smoothPath", () => {
  it("пустой список и одна точка не роняют разметку", () => {
    expect(smoothPath([])).toBe("");
    expect(smoothPath([{ x: 10, y: 20 }])).toBe("M 10 20");
  });

  it("начинается с первой точки и проходит через все", () => {
    const d = smoothPath([
      { x: 0, y: 50 },
      { x: 10, y: 40 },
      { x: 20, y: 60 },
    ]);

    expect(d.startsWith("M 0 50")).toBe(true);
    expect(d).toContain("10 40");
    expect(d).toContain("20 60");
  });

  it("кривая не выдумывает пиков за пределами соседних точек", () => {
    // Наивный Кэтмулл-Ром на резком переходе выгибается за коридор: между
    // 82 и 59 нарисовал бы провал ниже 59. Для процента, по которому
    // разговаривают с людьми, это вымысел, а не сглаживание.
    const d = smoothPath([
      { x: 0, y: 10 },
      { x: 10, y: 20 },
      { x: 20, y: 90 },
      { x: 30, y: 80 },
    ]);

    const ys = [...d.matchAll(/[ ,](-?\d+(?:\.\d+)?)(?=[ ,]|$)/g)]
      .map((m) => Number(m[1]))
      .filter((_, index) => index % 2 === 1);

    expect(Math.min(...ys)).toBeGreaterThanOrEqual(10);
    expect(Math.max(...ys)).toBeLessThanOrEqual(90);
  });

  it("нулевое натяжение даёт по сути ломаную", () => {
    const straight = smoothPath(
      [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ],
      0,
    );

    expect(straight).toBe("M 0 0 C 0 0, 10 10, 10 10");
  });
});

describe("areaPath", () => {
  it("замыкается до основания и закрывается", () => {
    const d = areaPath(
      [
        { x: 0, y: 10 },
        { x: 20, y: 30 },
      ],
      100,
    );

    expect(d).toContain("L 20 100");
    expect(d).toContain("L 0 100");
    expect(d.endsWith("Z")).toBe(true);
  });

  it("по одной точке заливку не строит — площади нет", () => {
    expect(areaPath([{ x: 0, y: 10 }], 100)).toBe("");
    expect(areaPath([], 100)).toBe("");
  });
});

describe("objectionBars", () => {
  function objection(overrides: Partial<QualityObjectionRow>): QualityObjectionRow {
    return { objection: "Далеко добираться", reviews_count: 10, scored_count: 10, avg_total: 55, ...overrides };
  }

  it("длина полосы — доля от всех возражений, а не качество отработки", () => {
    // Два вопроса, две величины: длиной меряется «что слышим чаще», а
    // качество стоит рядом числом.
    const bars = objectionBars([
      objection({ objection: "Нашёл другую работу", reviews_count: 75 }),
      objection({ objection: "Не устраивает з/п", reviews_count: 25 }),
    ]);

    expect(bars[0].value).toBe(75);
    expect(bars[1].value).toBe(25);
  });

  it("рядом с качеством всегда стоит число случаев", () => {
    // «Я подумаю» отрабатывается на 37%, но случаев пять — по такой выборке
    // вывода не сделать, и это должно быть видно сразу.
    const bars = objectionBars([objection({ objection: "Я подумаю", reviews_count: 5, avg_total: 37.5 })]);

    expect(bars[0].note).toBe("5 · отработано 37.5%");
  });

  it("порядок задаёт база и его не пересортировывают", () => {
    const bars = objectionBars([
      objection({ objection: "Частое", reviews_count: 100 }),
      objection({ objection: "Редкое", reviews_count: 1 }),
    ]);

    expect(bars.map((b) => b.label)).toEqual(["Частое", "Редкое"]);
  });

  it("возражение без единого итога подписано числом случаев", () => {
    const bars = objectionBars([objection({ reviews_count: 3, scored_count: 0, avg_total: null })]);

    expect(bars[0].note).toBe("3 случая");
  });

  it("нет возражений — нет графика", () => {
    expect(objectionBars([])).toEqual([]);
  });
});
