import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { parserLavkaV1 } from "./parser_lavka";

const CONFIG = {
  task: "Задача",
  position: "Теги",
  demand: "Количество вакансий",
  date: "Обновлено",
  status: "Статус",
};

const HEADERS = ["Приоритет", "Задача", "Статус", "Теги", "Обновлено", "Количество вакансий"];

function makeWorkbook(rows: { task: string; status: string; position: string; date: Date; demand?: string }[]): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sheet0");
  sheet.addRow(HEADERS);
  for (const row of rows) {
    sheet.addRow(["Средний", row.task, row.status, row.position, row.date, row.demand ?? null]);
  }
  return workbook;
}

describe("parserLavkaV1", () => {
  it("canParse is true when all required headers are present", () => {
    const workbook = makeWorkbook([]);
    expect(parserLavkaV1.canParse(workbook, CONFIG)).toBe(true);
  });

  it("canParse is false when a required header is missing", () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("Sheet0").addRow(["Задача", "Статус"]);
    expect(parserLavkaV1.canParse(workbook, CONFIG)).toBe(false);
  });

  it("splits city and address out of the Задача column", () => {
    const workbook = makeWorkbook([
      {
        task: "Москва | Вакансия Кладовщик для площадки: МСК Щелковское шоссе, 21 А | 2023102403",
        status: "Открыт",
        position: "Кладовщик",
        date: new Date("2026-07-31T11:04:31.955Z"),
      },
    ]);
    const { rows, errors } = parserLavkaV1.extractRows(workbook, CONFIG, "Лавка");
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      {
        rowNumber: 2,
        project: "Лавка",
        city: "Москва",
        address: "МСК Щелковское шоссе, 21 А",
        position: "Кладовщик",
        date: "2026-07-31",
        demand: "1",
      },
    ]);
  });

  it("defaults demand to 1 when Количество вакансий is empty (one ticket = one open position)", () => {
    const workbook = makeWorkbook([
      {
        task: "Москва | Вакансия Курьер для площадки: ул. Ленина, 1 | 123",
        status: "Открыт",
        position: "Курьер",
        date: new Date("2026-08-01T00:00:00Z"),
      },
    ]);
    const { rows } = parserLavkaV1.extractRows(workbook, CONFIG, "Лавка");
    expect(rows[0]!.demand).toBe("1");
  });

  it("uses an explicit Количество вакансий value when present", () => {
    const workbook = makeWorkbook([
      {
        task: "Москва | Вакансия Курьер для площадки: ул. Ленина, 1 | 123",
        status: "Открыт",
        position: "Курьер",
        date: new Date("2026-08-01T00:00:00Z"),
        demand: "3",
      },
    ]);
    const { rows } = parserLavkaV1.extractRows(workbook, CONFIG, "Лавка");
    expect(rows[0]!.demand).toBe("3");
  });

  it("skips tickets with status Закрыт entirely", () => {
    const workbook = makeWorkbook([
      {
        task: "Москва | Вакансия Курьер для площадки: ул. Ленина, 1 | 123",
        status: "Закрыт",
        position: "Курьер",
        date: new Date("2026-08-01T00:00:00Z"),
      },
    ]);
    const { rows, errors } = parserLavkaV1.extractRows(workbook, CONFIG, "Лавка");
    expect(rows).toEqual([]);
    expect(errors).toEqual([]);
  });

  it("keeps open, pending and approval-required statuses", () => {
    const workbook = makeWorkbook([
      { task: "Москва | Вакансия Курьер для площадки: ул. Ленина, 1 | 1", status: "Открыт", position: "Курьер", date: new Date("2026-08-01") },
      { task: "Москва | Вакансия Курьер для площадки: ул. Ленина, 2 | 2", status: "Готов к выходу", position: "Курьер", date: new Date("2026-08-01") },
      { task: "Москва | Вакансия Курьер для площадки: ул. Ленина, 3 | 3", status: "Ожидает подтверждения", position: "Курьер", date: new Date("2026-08-01") },
      { task: "Москва | Вакансия Курьер для площадки: ул. Ленина, 4 | 4", status: "Требуется согласование", position: "Курьер", date: new Date("2026-08-01") },
    ]);
    const { rows } = parserLavkaV1.extractRows(workbook, CONFIG, "Лавка");
    expect(rows).toHaveLength(4);
  });

  it("tolerates a trailing note after the ticket code (real-world 'бронь' rows)", () => {
    const workbook = makeWorkbook([
      {
        task: "Москва | Вакансия Сборщик для площадки: МСК Зелёный проспект, 91 | 2025082701 (бронь ООО Виста) 17.07",
        status: "Открыт",
        position: "Сборщик",
        date: new Date("2026-08-01T00:00:00Z"),
      },
    ]);
    const { rows, errors } = parserLavkaV1.extractRows(workbook, CONFIG, "Лавка");
    expect(errors).toEqual([]);
    expect(rows[0]!.address).toBe("МСК Зелёный проспект, 91");
  });

  it("reports a row error when the Задача text doesn't match the expected pattern", () => {
    const workbook = makeWorkbook([{ task: "какой-то произвольный текст без разделителей", status: "Открыт", position: "Курьер", date: new Date() }]);
    const { rows, errors } = parserLavkaV1.extractRows(workbook, CONFIG, "Лавка");
    expect(rows).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.reason).toContain("Не удалось разобрать");
  });

  it("skips genuinely empty sheet rows without raising an error", () => {
    const workbook = makeWorkbook([]);
    const sheet = workbook.worksheets[0]!;
    sheet.addRow([]);
    const { rows, errors } = parserLavkaV1.extractRows(workbook, CONFIG, "Лавка");
    expect(rows).toEqual([]);
    expect(errors).toEqual([]);
  });
});
