import { describe, expect, it } from "vitest";
import {
  DEFAULT_COLUMNS,
  REVIEW_COLUMNS,
  normalizeColumns,
  toggleColumn,
  type ReviewColumnId,
} from "./reviewColumns";

describe("normalizeColumns", () => {
  it("без настройки показываются умолчания", () => {
    expect(normalizeColumns(null)).toEqual(DEFAULT_COLUMNS);
    expect(normalizeColumns(undefined)).toEqual(DEFAULT_COLUMNS);
  });

  it("мусор в хранилище не оставляет таблицу без колонок", () => {
    // Записать туда могли что угодно — чужой скрипт, старая версия портала,
    // ручная правка. Пустая таблица хуже проигнорированной настройки.
    expect(normalizeColumns("не массив")).toEqual(DEFAULT_COLUMNS);
    expect(normalizeColumns({ employee: true })).toEqual(DEFAULT_COLUMNS);
    expect(normalizeColumns([])).toEqual(DEFAULT_COLUMNS);
    expect(normalizeColumns([1, 2, 3])).toEqual(DEFAULT_COLUMNS);
  });

  it("незнакомые колонки отбрасываются, знакомые остаются", () => {
    const result = normalizeColumns(["employee", "lead", "выдуманная", "total"]);

    expect(result).toEqual(["employee", "lead", "total"]);
  });

  it("обязательная колонка возвращается, даже если её не сохранили", () => {
    expect(normalizeColumns(["lead", "total", "project"])).toContain("employee");
  });

  it("порядок берётся из кода, а не из хранилища", () => {
    // Иначе перестановка колонок в REVIEW_COLUMNS не доехала бы до тех, у
    // кого настройка уже сохранена.
    const result = normalizeColumns(["case", "lead", "employee"]);

    expect(result).toEqual(["employee", "lead", "case"]);
  });

  it("сохранённый выбор из одной обязательной колонки лечится умолчаниями", () => {
    expect(normalizeColumns(["employee"])).toEqual(DEFAULT_COLUMNS);
  });
});

describe("toggleColumn", () => {
  const base: ReviewColumnId[] = ["employee", "reviewDate", "lead", "total", "reviewer"];

  it("выключает показанную колонку", () => {
    expect(toggleColumn(base, "lead")).not.toContain("lead");
  });

  it("включает спрятанную и ставит её на место из REVIEW_COLUMNS", () => {
    const result = toggleColumn(base, "project");

    expect(result).toContain("project");
    expect(result.indexOf("project")).toBeGreaterThan(result.indexOf("lead"));
    expect(result.indexOf("project")).toBeLessThan(result.indexOf("total"));
  });

  it("обязательную колонку выключить нельзя", () => {
    expect(toggleColumn(base, "employee")).toContain("employee");
  });

  it("неизвестный идентификатор ничего не меняет", () => {
    expect(toggleColumn(base, "выдуманная" as ReviewColumnId)).toEqual(base);
  });

  it("выключение последней необязательной возвращает умолчания, а не пустую таблицу", () => {
    let visible: ReviewColumnId[] = ["employee", "lead"];
    visible = toggleColumn(visible, "lead");

    expect(visible).toEqual(DEFAULT_COLUMNS);
  });
});

describe("состав колонок", () => {
  it("обязательная колонка ровно одна — сотрудник", () => {
    const required = REVIEW_COLUMNS.filter((column) => column.required).map((column) => column.id);

    expect(required).toEqual(["employee"]);
  });

  it("«Комментарии и рекомендации» показываются по умолчанию — их и просили", () => {
    expect(DEFAULT_COLUMNS).toContain("recommendations");
  });

  it("«Нарушение» по умолчанию спрятано: причина обнуления подписана в итоге", () => {
    expect(DEFAULT_COLUMNS).not.toContain("violation");
  });

  it("идентификаторы колонок не повторяются", () => {
    const ids = REVIEW_COLUMNS.map((column) => column.id);

    expect(new Set(ids).size).toBe(ids.length);
  });
});
