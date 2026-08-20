import { describe, expect, it } from "vitest";
import type { QualityChecklistRow } from "@/lib/supabase/quality.types";
import {
  asItemScale,
  formatPercent,
  leadUrl,
  optionsWithCurrent,
  pickChecklist,
  scaleValueLabel,
  scaleValues,
  scoreTone,
} from "./qualityOptions";

function checklist(overrides: Partial<QualityChecklistRow> & { id: string }): QualityChecklistRow {
  return {
    kind: "call",
    project: null,
    title: "Шаблон",
    archived_at: null,
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    created_by: null,
    updated_by: null,
    version: 1,
    ...overrides,
  } as QualityChecklistRow;
}

describe("pickChecklist", () => {
  const universal = checklist({ id: "universal" });
  const projectOne = checklist({ id: "samokat", project: "Самокат" });
  const refusal = checklist({ id: "refusal", kind: "refusal" });

  it("шаблон проекта точнее общего", () => {
    expect(pickChecklist([universal, projectOne], "call", "Самокат")?.id).toBe("samokat");
  });

  it("без шаблона проекта берётся общий", () => {
    expect(pickChecklist([universal, projectOne], "call", "Яндекс Лавка")?.id).toBe("universal");
  });

  it("вид проверки отсекается первым: общий шаблон чужого вида не подходит", () => {
    expect(pickChecklist([refusal], "call", "Самокат")).toBeNull();
  });

  it("проект без единого шаблона своего вида даёт null, а не чужой шаблон", () => {
    expect(pickChecklist([projectOne], "call", "Яндекс Лавка")).toBeNull();
  });

  it("архивный шаблон проекта не выигрывает у действующего общего", () => {
    // 19 августа восемь проектных шаблонов заархивировали в пользу одного
    // общего. Просочись такой в список — он победил бы по точности
    // совпадения, и проверка заполнялась бы по составу, от которого отказались.
    const archived = checklist({ id: "old-samokat", project: "Самокат", archived_at: "2026-08-19T00:00:00Z" });

    expect(pickChecklist([universal, archived], "call", "Самокат")?.id).toBe("universal");
  });

  it("архивный общий шаблон не подставляется вместо отсутствующего", () => {
    const archived = checklist({ id: "old-universal", archived_at: "2026-08-19T00:00:00Z" });

    expect(pickChecklist([archived], "call", "Самокат")).toBeNull();
  });

  it("пустой список шаблонов не роняет подбор", () => {
    expect(pickChecklist([], "call", "Самокат")).toBeNull();
  });
});

describe("formatPercent", () => {
  it("прочерк вместо нуля, когда считать было не из чего", () => {
    // Разница смысловая: «0%» — это провал, «—» — блок не оценивался.
    expect(formatPercent(null)).toBe("—");
    expect(formatPercent(undefined)).toBe("—");
    expect(formatPercent(0)).toBe("0%");
  });

  it("целое показывается без хвоста, дробное — с двумя знаками", () => {
    expect(formatPercent(100)).toBe("100%");
    expect(formatPercent(83.33)).toBe("83.33%");
    expect(formatPercent(66.666)).toBe("66.67%");
  });
});

describe("scoreTone", () => {
  it("границы порогов относятся к лучшему тону", () => {
    expect(scoreTone(90)).toBe("green");
    expect(scoreTone(89.99)).toBe("amber");
    expect(scoreTone(70)).toBe("amber");
    expect(scoreTone(69.99)).toBe("red");
  });

  it("отсутствие итога не красится в красный", () => {
    // Обнулённый критической ошибкой итог — красный; неоценённая проверка —
    // серая. Смешивать их значит показывать провал там, где его не было.
    expect(scoreTone(null)).toBe("gray");
    expect(scoreTone(0)).toBe("red");
  });
});

describe("шкалы пунктов", () => {
  it("неизвестная шкала трактуется как полная", () => {
    expect(asItemScale("0-1-2")).toBe("0-1-2");
    expect(asItemScale("0-2")).toBe("0-2");
    expect(asItemScale("yes_no")).toBe("yes_no");
    expect(asItemScale("что-то новое")).toBe("0-1-2");
  });

  it("варианты идут от худшего к лучшему", () => {
    expect(scaleValues("0-1-2")).toEqual([0, 1, 2]);
    expect(scaleValues("0-2")).toEqual([0, 2]);
    expect(scaleValues("yes_no")).toEqual([0, 1]);
  });

  it("«частично» есть только у полной шкалы", () => {
    expect(scaleValueLabel("0-1-2", 1)).toBe("Частично");
    expect(scaleValueLabel("0-2", 2)).toBe("Да");
    expect(scaleValueLabel("0-2", 0)).toBe("Нет");
    expect(scaleValueLabel("yes_no", 1)).toBe("Да");
    expect(scaleValueLabel("yes_no", 0)).toBe("Нет");
  });
});

describe("optionsWithCurrent", () => {
  it("отключённое значение прошлой проверки не пропадает из списка", () => {
    // Без этого select показал бы пустое поле, а сохранение стёрло бы
    // возражение или город прошлой проверки — молча.
    expect(optionsWithCurrent(["Далеко добираться"], "Нет потребности")).toEqual([
      "Нет потребности",
      "Далеко добираться",
    ]);
  });

  it("действующее значение не дублируется", () => {
    expect(optionsWithCurrent(["Москва", "Казань"], "Казань")).toEqual(["Москва", "Казань"]);
  });

  it("пустое значение ничего не добавляет — прочерк рисует сама форма", () => {
    expect(optionsWithCurrent(["Москва"], "")).toEqual(["Москва"]);
    expect(optionsWithCurrent(["Москва"], null)).toEqual(["Москва"]);
  });

  it("пустой справочник со значением показывает хотя бы это значение", () => {
    expect(optionsWithCurrent([], "Опоздание")).toEqual(["Опоздание"]);
  });
});

describe("leadUrl", () => {
  it("собирается из номера, а не хранится строкой", () => {
    // В исходных таблицах лежал полный URL; смена адреса CRM была бы
    // миграцией всех строк, а не правкой одной константы.
    expect(leadUrl(1234567)).toBe("https://portal.sth-group.ru/crm/lead/details/1234567/");
  });
});
