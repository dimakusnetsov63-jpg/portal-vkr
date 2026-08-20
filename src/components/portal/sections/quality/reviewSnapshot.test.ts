import { describe, expect, it } from "vitest";
import type { QualityScoreRow } from "@/lib/supabase/quality.types";
import { buildReviewSnapshot, formatAnswer } from "./reviewSnapshot";

function score(overrides: Partial<QualityScoreRow> = {}): QualityScoreRow {
  return {
    review_id: "r1",
    item_id: "i1",
    value: 2,
    is_na: false,
    note: null,
    item_title: "Пункт",
    group_id: "g1",
    group_title: "Блок",
    group_sort_order: 1,
    item_sort_order: 1,
    ...overrides,
  };
}

describe("buildReviewSnapshot — проверка рисуется из своих ответов", () => {
  it("группирует ответы по блокам и подставляет проценты блоков", () => {
    const groups = buildReviewSnapshot(
      [
        score({ item_id: "a", group_id: "g1", group_title: "Контакт", item_title: "Приветствие" }),
        score({ item_id: "b", group_id: "g2", group_title: "Возражения", group_sort_order: 2, item_title: "Аргументация" }),
      ],
      { g1: 100, g2: 50 },
    );

    expect(groups).toHaveLength(2);
    expect(groups[0].title).toBe("Контакт");
    expect(groups[0].percent).toBe(100);
    expect(groups[1].title).toBe("Возражения");
    expect(groups[1].percent).toBe(50);
  });

  it("соблюдает порядок блоков и пунктов из снимка, а не порядок строк", () => {
    // Строки приходят вперемешку — PostgREST не обязан отдавать их
    // отсортированными, и полагаться на это нельзя.
    const groups = buildReviewSnapshot(
      [
        score({ item_id: "b2", group_id: "g2", group_sort_order: 2, item_sort_order: 2, item_title: "Второй у второго" }),
        score({ item_id: "a2", group_id: "g1", group_sort_order: 1, item_sort_order: 2, item_title: "Второй у первого" }),
        score({ item_id: "b1", group_id: "g2", group_sort_order: 2, item_sort_order: 1, item_title: "Первый у второго" }),
        score({ item_id: "a1", group_id: "g1", group_sort_order: 1, item_sort_order: 1, item_title: "Первый у первого" }),
      ],
      {},
    );

    expect(groups.map((g) => g.groupId)).toEqual(["g1", "g2"]);
    expect(groups[0].items.map((i) => i.title)).toEqual(["Первый у первого", "Второй у первого"]);
    expect(groups[1].items.map((i) => i.title)).toEqual(["Первый у второго", "Второй у второго"]);
  });

  it("блок без числа даёт null, а не ноль", () => {
    const groups = buildReviewSnapshot([score({ group_id: "g1" })], { g1: null });
    expect(groups[0].percent).toBeNull();
  });

  it("блок, которого нет в group_scores, тоже показывается — с прочерком", () => {
    // Так выглядит проверка, сохранённая до появления снимка процентов по
    // какому-то блоку: ответы есть, числа нет.
    const groups = buildReviewSnapshot([score({ group_id: "g9" })], {});
    expect(groups).toHaveLength(1);
    expect(groups[0].percent).toBeNull();
  });

  it("B2: формулировка берётся из снимка, а не из текущего шаблона", () => {
    // Пункт в шаблоне с тех пор переименован — в карточке обязана остаться
    // та формулировка, по которой ставили оценку.
    const groups = buildReviewSnapshot(
      [score({ item_title: "Озвучена цель звонка" })],
      { g1: 100 },
    );
    expect(groups[0].items[0].title).toBe("Озвучена цель звонка");
  });

  it("пустой список ответов даёт пустой снимок, без падения", () => {
    expect(buildReviewSnapshot([], { g1: 50 })).toEqual([]);
  });
});

describe("formatAnswer — ответ в человеческом виде", () => {
  it.each([
    [{ value: 2, isNa: false }, "Да"],
    [{ value: 1, isNa: false }, "Частично"],
    [{ value: 0, isNa: false }, "Нет"],
    [{ value: null, isNa: true }, "н/д"],
    [{ value: null, isNa: false }, "—"],
  ])("%o → %s", (partial, expected) => {
    expect(formatAnswer({ itemId: "i", title: "t", note: null, ...partial })).toBe(expected);
  });
});
