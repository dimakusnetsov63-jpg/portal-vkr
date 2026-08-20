import { describe, expect, it } from "vitest";
import {
  addGroup,
  addItem,
  copyDraft,
  draftToPayload,
  emptyChecklist,
  moveGroup,
  moveItem,
  removeGroup,
  removeItem,
  updateGroup,
  updateItem,
  validateChecklistDraft,
  type ChecklistDraft,
  type GroupDraft,
  type ItemDraft,
} from "./checklistDraft";

function item(overrides: Partial<ItemDraft> = {}): ItemDraft {
  return { id: "i1", title: "Пункт", scale: "0-1-2", weight: 1, allowNa: true, isCritical: false, ...overrides };
}

function group(overrides: Partial<GroupDraft> = {}): GroupDraft {
  return { id: "g1", title: "Блок", countsInTotal: true, items: [item()], ...overrides };
}

function draft(overrides: Partial<ChecklistDraft> = {}): ChecklistDraft {
  return { title: "Шаблон", kind: "call", project: "", groups: [group()], ...overrides };
}

describe("перестановки", () => {
  const three = draft({
    groups: [
      group({ id: "a", title: "А" }),
      group({ id: "b", title: "Б" }),
      group({ id: "c", title: "В" }),
    ],
  });

  it("блок поднимается и опускается", () => {
    expect(moveGroup(three, 1, -1).groups.map((g) => g.title)).toEqual(["Б", "А", "В"]);
    expect(moveGroup(three, 1, 1).groups.map((g) => g.title)).toEqual(["А", "В", "Б"]);
  });

  it("край списка не роняет и не теряет блоки", () => {
    expect(moveGroup(three, 0, -1).groups.map((g) => g.title)).toEqual(["А", "Б", "В"]);
    expect(moveGroup(three, 2, 1).groups.map((g) => g.title)).toEqual(["А", "Б", "В"]);
  });

  it("перестановка сохраняет id — иначе строка сохранится как новая", () => {
    // Потеря id не выглядит ошибкой на экране: старый блок ушёл бы в архив
    // вместе со ссылками из прошлых проверок, а рядом появился бы близнец.
    expect(moveGroup(three, 0, 1).groups.map((g) => g.id)).toEqual(["b", "a", "c"]);
  });

  it("пункт переставляется внутри своего блока", () => {
    const withItems = draft({
      groups: [group({ items: [item({ id: "1", title: "Раз" }), item({ id: "2", title: "Два" })] })],
    });

    expect(moveItem(withItems, 0, 0, 1).groups[0].items.map((i) => i.title)).toEqual(["Два", "Раз"]);
  });

  it("перестановка в несуществующем блоке ничего не ломает", () => {
    expect(moveItem(three, 9, 0, 1)).toEqual(three);
  });
});

describe("правка и состав", () => {
  it("правка блока не задевает остальные", () => {
    const two = draft({ groups: [group({ id: "a", title: "А" }), group({ id: "b", title: "Б" })] });
    const result = updateGroup(two, 0, { countsInTotal: false });

    expect(result.groups[0].countsInTotal).toBe(false);
    expect(result.groups[1]).toEqual(two.groups[1]);
  });

  it("правка пункта не задевает соседей", () => {
    const withItems = draft({ groups: [group({ items: [item({ id: "1" }), item({ id: "2" })] })] });
    const result = updateItem(withItems, 0, 1, { weight: 3 });

    expect(result.groups[0].items[0].weight).toBe(1);
    expect(result.groups[0].items[1].weight).toBe(3);
  });

  it("добавление и удаление блоков и пунктов", () => {
    expect(addGroup(draft()).groups).toHaveLength(2);
    expect(removeGroup(draft(), 0).groups).toHaveLength(0);
    expect(addItem(draft(), 0).groups[0].items).toHaveLength(2);
    expect(removeItem(draft(), 0, 0).groups[0].items).toHaveLength(0);
  });

  it("новый блок и новый пункт приходят без id", () => {
    const added = addGroup(draft());

    expect(added.groups[1].id).toBeNull();
    expect(added.groups[1].items[0].id).toBeNull();
  });
});

describe("copyDraft", () => {
  it("обнуляет все идентификаторы", () => {
    const source = draft({
      groups: [group({ id: "g", items: [item({ id: "i1" }), item({ id: "i2" })] })],
    });
    const copy = copyDraft(source, "Копия");

    expect(copy.title).toBe("Копия");
    expect(copy.groups[0].id).toBeNull();
    expect(copy.groups[0].items.map((i) => i.id)).toEqual([null, null]);
  });

  it("не трогает оригинал", () => {
    const source = draft({ groups: [group({ id: "g", items: [item({ id: "i1" })] })] });
    copyDraft(source, "Копия");

    expect(source.groups[0].id).toBe("g");
    expect(source.groups[0].items[0].id).toBe("i1");
  });

  it("состав и настройки переносятся целиком", () => {
    const source = draft({
      groups: [group({ countsInTotal: false, items: [item({ weight: 3, isCritical: true, allowNa: false })] })],
    });
    const copy = copyDraft(source, "Копия");

    expect(copy.groups[0].countsInTotal).toBe(false);
    expect(copy.groups[0].items[0]).toMatchObject({ weight: 3, isCritical: true, allowNa: false });
  });
});

describe("validateChecklistDraft", () => {
  it("исправный шаблон замечаний не даёт", () => {
    expect(validateChecklistDraft(draft())).toEqual([]);
  });

  it("название шаблона обязательно", () => {
    expect(validateChecklistDraft(draft({ title: "   " }))).toContain("Название шаблона обязательно.");
  });

  it("шаблон без блоков и блок без пунктов не сохраняются", () => {
    expect(validateChecklistDraft(draft({ groups: [] }))).toContain("В шаблоне должен быть хотя бы один блок.");
    expect(validateChecklistDraft(draft({ groups: [group({ items: [] })] }))).toContain(
      "В блоке «Блок» нет ни одного пункта.",
    );
  });

  it("шаблон, где ни один блок не идёт в итог, отвергается", () => {
    // Проверки по такому шаблону не имели бы итога никогда, а раздел
    // существует ради этой цифры.
    const errors = validateChecklistDraft(draft({ groups: [group({ countsInTotal: false })] }));

    expect(errors).toContain("Хотя бы один блок должен входить в итог — иначе итог не посчитается.");
  });

  it("два переключателя в одном блоке — ошибка", () => {
    const errors = validateChecklistDraft(
      draft({
        groups: [
          group({
            items: [item({ id: "1", title: "Было?", scale: "yes_no" }), item({ id: "2", title: "И это?", scale: "yes_no" })],
          }),
        ],
      }),
    );

    expect(errors).toContain("В блоке «Блок» больше одного переключателя.");
  });

  it("один переключатель — нормально", () => {
    const errors = validateChecklistDraft(
      draft({
        groups: [
          group({ items: [item({ id: "1", title: "Было?", scale: "yes_no" }), item({ id: "2", title: "Оценка" })] }),
        ],
      }),
    );

    expect(errors).toEqual([]);
  });

  it("вес меньше единицы и дробный вес отвергаются", () => {
    expect(validateChecklistDraft(draft({ groups: [group({ items: [item({ weight: 0 })] })] }))).toHaveLength(1);
    expect(validateChecklistDraft(draft({ groups: [group({ items: [item({ weight: 1.5 })] })] }))).toHaveLength(1);
  });

  it("повторяющиеся пункты в блоке отлавливаются без учёта регистра и пробелов", () => {
    const errors = validateChecklistDraft(
      draft({
        groups: [group({ items: [item({ id: "1", title: "Приветствие" }), item({ id: "2", title: "  приветствие " })] })],
      }),
    );

    expect(errors).toContain("В блоке «Блок» есть повторяющиеся пункты.");
  });

  it("одинаковые пункты в разных блоках — не ошибка", () => {
    // «Призыв к действию» встречается и в возражениях, и в завершении звонка.
    const errors = validateChecklistDraft(
      draft({
        groups: [
          group({ id: "a", title: "А", items: [item({ title: "Призыв к действию" })] }),
          group({ id: "b", title: "Б", items: [item({ title: "Призыв к действию" })] }),
        ],
      }),
    );

    expect(errors).toEqual([]);
  });

  it("безымянный блок называется своим номером, чтобы замечание было адресным", () => {
    const errors = validateChecklistDraft(draft({ groups: [group({ title: "" })] }));

    expect(errors).toContain("Название блока обязательно (блок 1).");
  });
});

describe("draftToPayload", () => {
  it("порядок берётся из положения в списке, а не из старых номеров", () => {
    const payload = draftToPayload(
      draft({ groups: [group({ id: "a", title: "А" }), group({ id: "b", title: "Б" })] }),
    ) as { groups: { sort_order: number; items: { sort_order: number }[] }[] };

    expect(payload.groups.map((g) => g.sort_order)).toEqual([1, 2]);
    expect(payload.groups[0].items[0].sort_order).toBe(1);
  });

  it("пустой проект становится null — это общий шаблон", () => {
    expect((draftToPayload(draft({ project: "" })) as { project: string | null }).project).toBeNull();
    expect((draftToPayload(draft({ project: "Самокат" })) as { project: string | null }).project).toBe("Самокат");
  });

  it("пробелы по краям названий срезаются", () => {
    const payload = draftToPayload(
      draft({ title: "  Шаблон  ", groups: [group({ title: " Блок ", items: [item({ title: " Пункт " })] })] }),
    ) as { title: string; groups: { title: string; items: { title: string }[] }[] };

    expect(payload.title).toBe("Шаблон");
    expect(payload.groups[0].title).toBe("Блок");
    expect(payload.groups[0].items[0].title).toBe("Пункт");
  });

  it("переключатель уходит без «н/д», что бы ни стояло в черновике", () => {
    // У вопроса «было или нет» третьего состояния нет — команда КЦ убрала
    // его 20 августа, и редактор не должен уметь вернуть.
    const payload = draftToPayload(
      draft({ groups: [group({ items: [item({ scale: "yes_no", allowNa: true })] })] }),
    ) as { groups: { items: { allow_na: boolean }[] }[] };

    expect(payload.groups[0].items[0].allow_na).toBe(false);
  });

  it("новые строки уходят с id = null", () => {
    const payload = draftToPayload(emptyChecklist()) as { groups: { id: null; items: { id: null }[] }[] };

    expect(payload.groups[0].id).toBeNull();
    expect(payload.groups[0].items[0].id).toBeNull();
  });
});
