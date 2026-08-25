import { describe, expect, it } from "vitest";
import type { EmployeeSummary } from "./qualitySummary";
import { barWidth, employeeBars, teamBars, weakestFirst, type BlockBar } from "./summaryChart";

function summary(byBlock: Record<string, number | null>, employee = "Иванов"): EmployeeSummary {
  return { employee, callReviews: 5, refusalReviews: 0, overall: 80, cases: 0, critical: 0, byBlock };
}

const blocks = [
  { title: "Установление контакта", countsInTotal: true },
  { title: "Возражения", countsInTotal: false },
];

describe("employeeBars", () => {
  it("считает отставание от команды", () => {
    const bars = employeeBars(
      summary({ "Установление контакта": 70, Возражения: 90 }),
      summary({ "Установление контакта": 85, Возражения: 60 }, "Все"),
      blocks,
    );

    expect(bars[0].delta).toBe(-15);
    expect(bars[1].delta).toBe(30);
  });

  it("без среднего по команде сравнения нет, а не ноль", () => {
    // «−78» против пустоты — не отставание, а бессмыслица.
    const bars = employeeBars(summary({ "Установление контакта": 78 }), null, blocks);

    expect(bars[0].value).toBe(78);
    expect(bars[0].baseline).toBeNull();
    expect(bars[0].delta).toBeNull();
  });

  it("неоценённый блок сотрудника не сравнивается", () => {
    const bars = employeeBars(summary({}), summary({ "Установление контакта": 85 }, "Все"), blocks);

    expect(bars[0].value).toBeNull();
    expect(bars[0].baseline).toBe(85);
    expect(bars[0].delta).toBeNull();
  });

  it("признак «не входит в итог» доходит до графика", () => {
    const bars = employeeBars(summary({}), null, blocks);

    expect(bars[1].title).toBe("Возражения");
    expect(bars[1].countsInTotal).toBe(false);
  });

  it("разница округляется до сотых, как и сами проценты", () => {
    const bars = employeeBars(
      summary({ "Установление контакта": 66.67 }),
      summary({ "Установление контакта": 33.33 }, "Все"),
      blocks,
    );

    expect(bars[0].delta).toBe(33.34);
  });
});

describe("teamBars", () => {
  it("у команды нет базы для сравнения — она сама база", () => {
    const bars = teamBars(summary({ "Установление контакта": 85 }, "Все"), blocks);

    expect(bars[0].value).toBe(85);
    expect(bars[0].baseline).toBeNull();
    expect(bars[0].delta).toBeNull();
  });
});

describe("weakestFirst", () => {
  function bar(title: string, value: number | null): BlockBar {
    return { title, countsInTotal: true, value, baseline: null, delta: null };
  }

  it("слабое сверху — график отвечает на «чему учить»", () => {
    const sorted = weakestFirst([bar("А", 90), bar("Б", 40), bar("В", 70)]);

    expect(sorted.map((b) => b.title)).toEqual(["Б", "В", "А"]);
  });

  it("неоценённые блоки уходят в конец, но не пропадают", () => {
    // Пустой блок сам по себе новость: его никто не оценивал.
    const sorted = weakestFirst([bar("А", null), bar("Б", 40), bar("В", null)]);

    expect(sorted.map((b) => b.title)).toEqual(["Б", "А", "В"]);
  });

  it("не мутирует исходный список", () => {
    const input = [bar("А", 90), bar("Б", 40)];
    weakestFirst(input);

    expect(input.map((b) => b.title)).toEqual(["А", "Б"]);
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
