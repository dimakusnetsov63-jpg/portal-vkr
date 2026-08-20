import { describe, expect, it } from "vitest";
import { burgerKingItems, burgerKingRows, refusalGroups, refusalRows } from "./qualityScore.fixtures";
import {
  calculateGroupPercent,
  calculateReviewScore,
  countUnanswered,
  parseLeadId,
  type AnswerMap,
  type ScoreGroup,
} from "./qualityScore";

/**
 * Главная проверка здесь — не синтетические примеры, а совпадение с
 * рабочими таблицами: двадцать реальных строк из «Чек-листы по проектам» и
 * «Самоотказы КЦ» вместе с процентами, которые посчитал сам Excel
 * (`qualityScore.fixtures.ts`, сгенерирован из файлов). Если переезд начнёт
 * менять людям цифры, это должно ломать сборку, а не всплывать на первом же
 * разборе результатов.
 */

function group(id: string, items: ScoreGroup["items"], countsInTotal = true): ScoreGroup {
  return { id, countsInTotal, items };
}

function scored(id: string, scale: ScoreGroup["items"][number]["scale"] = "0-1-2", isCritical = false) {
  return { id, scale, weight: 1, isCritical };
}

function answers(map: Record<string, number | null | "na">): AnswerMap {
  const result: AnswerMap = {};
  for (const [id, value] of Object.entries(map)) {
    result[id] = value === "na" ? { value: null, isNa: true } : { value, isNa: false };
  }
  return result;
}

describe("процент блока", () => {
  it("считает сумму баллов к удвоенному числу пунктов", () => {
    const block = group("g", [scored("a"), scored("b")]);
    expect(calculateGroupPercent(block, answers({ a: 2, b: 1 }))).toBe(75);
  });

  it("учитывает вес пункта", () => {
    const block = group("g", [
      { id: "a", scale: "0-1-2", weight: 3, isCritical: false },
      { id: "b", scale: "0-1-2", weight: 1, isCritical: false },
    ]);
    // (2×3 + 0×1) / (2×(3+1)) = 6/8
    expect(calculateGroupPercent(block, answers({ a: 2, b: 0 }))).toBe(75);
  });

  it("исключает «не применимо» из знаменателя, а не считает нулём", () => {
    const block = group("g", [scored("a"), scored("b")]);
    expect(calculateGroupPercent(block, answers({ a: 2, b: "na" }))).toBe(100);
  });

  it("даёт null, когда все пункты «не применимо»", () => {
    const block = group("g", [scored("a"), scored("b")]);
    expect(calculateGroupPercent(block, answers({ a: "na", b: "na" }))).toBeNull();
  });

  it("даёт null, когда переключатель ответил «Нет»", () => {
    const block = group("g", [scored("gate", "yes_no"), scored("a"), scored("b")]);
    // Баллы в блоке проставлены, но возражения не было — процент не считается.
    expect(calculateGroupPercent(block, answers({ gate: 0, a: 2, b: 2 }))).toBeNull();
  });

  it("считает блок, когда переключатель ответил «Да»", () => {
    const block = group("g", [scored("gate", "yes_no"), scored("a"), scored("b")]);
    // Сам переключатель баллов не даёт: знаменатель — два пункта, не три.
    expect(calculateGroupPercent(block, answers({ gate: 1, a: 2, b: 1 }))).toBe(75);
  });

  it("даёт null, а не деление на ноль, когда пунктов нет вовсе", () => {
    expect(calculateGroupPercent(group("g", []), {})).toBeNull();
  });
});

describe("итог проверки", () => {
  it("усредняет блоки, входящие в итог", () => {
    const groups = [group("a", [scored("a1")]), group("b", [scored("b1")])];
    const result = calculateReviewScore(groups, answers({ a1: 2, b1: 1 }));
    expect(result.groupScores).toEqual({ a: 100, b: 50 });
    expect(result.total).toBe(75);
  });

  it("не берёт в итог блок с countsInTotal = false", () => {
    // Ровно случай блока «Возражения»: считается и показывается, но в общий
    // процент не входит — как в исходном файле.
    const groups = [group("a", [scored("a1")]), group("objections", [scored("o1")], false)];
    const result = calculateReviewScore(groups, answers({ a1: 2, o1: 0 }));
    expect(result.groupScores).toEqual({ a: 100, objections: 0 });
    expect(result.total).toBe(100);
  });

  it("не берёт в итог блок без значения", () => {
    const groups = [group("a", [scored("a1")]), group("b", [scored("b1")])];
    const result = calculateReviewScore(groups, answers({ a1: 1, b1: "na" }));
    expect(result.total).toBe(50);
  });

  it("даёт null, когда ни один блок не дал числа", () => {
    const groups = [group("a", [scored("a1")]), group("b", [scored("b1")])];
    const result = calculateReviewScore(groups, answers({ a1: "na", b1: "na" }));
    expect(result.total).toBeNull();
    expect(result.groupScores).toEqual({ a: null, b: null });
  });

  it("обнуляет итог при нуле по критическому пункту", () => {
    const groups = [group("a", [scored("a1"), scored("a2", "0-2", true)])];
    const result = calculateReviewScore(groups, answers({ a1: 2, a2: 0 }));
    expect(result.hasCritical).toBe(true);
    expect(result.total).toBe(0);
    // Процент блока при этом остаётся честным — обнуляется именно итог.
    expect(result.groupScores.a).toBe(50);
  });

  it("не считает критической ошибкой «не применимо» по критическому пункту", () => {
    const groups = [group("a", [scored("a1"), scored("a2", "0-2", true)])];
    const result = calculateReviewScore(groups, answers({ a1: 2, a2: "na" }));
    expect(result.hasCritical).toBe(false);
    expect(result.total).toBe(100);
  });

  describe("нарушение обнуляет звонок", () => {
    const groups = [group("a", [scored("a1"), scored("a2")])];

    it("итог 0, проценты блоков настоящие", () => {
      // Решение 20 августа: обнуляется итог, но не блоки. Обнули мы и блоки
      // — сводка по блокам просела бы от одного нарушения, и понять, где
      // именно был провал, стало бы нельзя.
      const result = calculateReviewScore(groups, answers({ a1: 2, a2: 2 }), true);

      expect(result.total).toBe(0);
      expect(result.groupScores.a).toBe(100);
      expect(result.isZeroed).toBe(true);
    });

    it("нарушение — не то же самое, что критический пункт", () => {
      // Причины обнуления две и они независимы: hasCritical говорит про
      // чек-лист, нарушение — про поле проверки. Смешать их значило бы
      // показать баннер «критическая ошибка» там, где её не было.
      const result = calculateReviewScore(groups, answers({ a1: 2, a2: 2 }), true);

      expect(result.hasCritical).toBe(false);
    });

    it("обнуляет и заполненную наполовину проверку, и пустую", () => {
      expect(calculateReviewScore(groups, answers({ a1: 1 }), true).total).toBe(0);
      // Без нарушения пустая проверка дала бы null: считать было не из чего.
      expect(calculateReviewScore(groups, {}, false).total).toBeNull();
      expect(calculateReviewScore(groups, {}, true).total).toBe(0);
    });

    it("без нарушения ничего не меняется", () => {
      const result = calculateReviewScore(groups, answers({ a1: 2, a2: 2 }), false);

      expect(result.total).toBe(100);
      expect(result.isZeroed).toBe(false);
    });

    it("критический пункт и нарушение вместе не спорят", () => {
      const withCritical = [group("a", [scored("a1"), scored("a2", "0-2", true)])];
      const result = calculateReviewScore(withCritical, answers({ a1: 2, a2: 0 }), true);

      expect(result.total).toBe(0);
      expect(result.hasCritical).toBe(true);
      expect(result.isZeroed).toBe(true);
    });
  });

  it("усредняет неокруглённые проценты блоков", () => {
    // 7 пунктов из 7 по 1 баллу = 50%, второй блок 100%. Если округлять
    // проценты блоков до усреднения, итог поедет в третьем знаке — именно
    // так расходятся портал и Excel на реальных строках.
    const first = group("a", Array.from({ length: 7 }, (_, i) => scored(`a${i}`)));
    const second = group("b", [scored("b1")]);
    const map = answers({
      ...Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`a${i}`, 1])),
      b1: 2,
    });
    expect(calculateReviewScore([first, second], map).total).toBe(75);
  });
});

describe("сверка с рабочими таблицами: чек-лист «Бургер Кинг»", () => {
  // Пункты идут в том же порядке, что колонки листа, поэтому блоки
  // собираются прямо из фикстуры.
  const groups: ScoreGroup[] = [];
  burgerKingItems.forEach((item, index) => {
    const id = `i${index}`;
    const last = groups[groups.length - 1];
    const entry = { id, scale: item.scale, weight: 1, isCritical: false };
    if (last && last.id === item.group) last.items.push(entry);
    else groups.push({ id: item.group, countsInTotal: item.group !== "Возражения", items: [entry] });
  });

  it.each(burgerKingRows)("лид $lead: итог совпадает с Excel", (row) => {
    const map: AnswerMap = {};
    row.values.forEach((value, index) => {
      map[`i${index}`] = { value, isNa: false };
    });

    const result = calculateReviewScore(groups, map);

    expect(result.total).not.toBeNull();
    // Excel хранит итог неокруглённым (80.08928571…), портал округляет до
    // сотых — расхождение не должно выходить за половину копейки.
    expect(Math.abs((result.total as number) - (row.expectedTotal as number))).toBeLessThanOrEqual(0.005);

    for (const [title, expected] of Object.entries(row.expectedGroups)) {
      if (expected === null) continue;
      const actual = result.groupScores[title];
      expect(actual, `блок «${title}»`).not.toBeNull();
      expect(Math.abs((actual as number) - expected), `блок «${title}»`).toBeLessThanOrEqual(0.005);
    }
  });

  it("блок «Возражения» ни в одной строке не влияет на итог", () => {
    for (const row of burgerKingRows) {
      const map: AnswerMap = {};
      row.values.forEach((value, index) => {
        map[`i${index}`] = { value, isNa: false };
      });
      const withObjections = calculateReviewScore(groups, map).total;

      const objectionGroup = groups.find((item) => item.id === "Возражения");
      const cleared: AnswerMap = { ...map };
      for (const item of objectionGroup?.items ?? []) cleared[item.id] = { value: null, isNa: true };

      expect(calculateReviewScore(groups, cleared).total).toBe(withObjections);
    }
  });
});

describe("сверка с рабочими таблицами: самоотказы", () => {
  // Каждый критерий — блок из одного пункта, как в seed-миграции: процент
  // такого блока и есть 0% / 50% / 100% из формулы исходного файла.
  const groups: ScoreGroup[] = refusalGroups.map((title, index) => ({
    id: title,
    countsInTotal: true,
    items: [{ id: `c${index}`, scale: "0-1-2", weight: 1, isCritical: false }],
  }));

  it.each(refusalRows)("лид $lead: проценты по критериям совпадают с Excel", (row) => {
    const map: AnswerMap = {};
    row.values.forEach((value, index) => {
      map[`c${index}`] = { value, isNa: false };
    });

    const result = calculateReviewScore(groups, map);

    row.values.forEach((value, index) => {
      // Формула файла: IF(x=0;0%;IF(x=1;50%;IF(x=2;100%))). Excel сохранил
      // вычисленное значение не во всех ячейках (у нулевых процентов кэша
      // нет вовсе), поэтому сверяем и с формулой, и — где значение есть —
      // с ним самим.
      const title = refusalGroups[index];
      const expectedByFormula = value === null ? null : value * 50;
      expect(result.groupScores[title], `критерий «${title}»`).toBe(expectedByFormula);

      const cached = row.expectedGroups[title];
      if (cached !== null && cached !== undefined) {
        expect(result.groupScores[title], `критерий «${title}» против Excel`).toBe(cached);
      }
    });
  });
});

describe("незаполненные пункты", () => {
  it("считает пункты без ответа", () => {
    const block = group("g", [scored("a"), scored("b"), scored("c")]);
    expect(countUnanswered(block, answers({ a: 2 }))).toBe(2);
  });

  it("не считает «не применимо» незаполненным", () => {
    const block = group("g", [scored("a"), scored("b")]);
    expect(countUnanswered(block, answers({ a: 2, b: "na" }))).toBe(0);
  });

  it("не требует заполнять блок с закрытым переключателем", () => {
    const block = group("g", [scored("gate", "yes_no"), scored("a"), scored("b")]);
    expect(countUnanswered(block, answers({ gate: 0 }))).toBe(0);
  });
});

describe("разбор номера лида", () => {
  it("принимает голый номер", () => {
    expect(parseLeadId("3660718")).toBe(3660718);
  });

  it("принимает ссылку из CRM целиком", () => {
    expect(parseLeadId("https://portal.sth-group.ru/crm/lead/details/3660718/")).toBe(3660718);
  });

  it("терпит пробелы вокруг", () => {
    expect(parseLeadId("  3660718 ")).toBe(3660718);
  });

  it("возвращает null на пустой строке и на тексте без номера", () => {
    expect(parseLeadId("")).toBeNull();
    expect(parseLeadId("   ")).toBeNull();
    expect(parseLeadId("нет номера")).toBeNull();
  });
});
