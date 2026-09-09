import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { parserLavkaV1 } from "./parser_lavka";
import { EMPTY_CONDITIONS } from "../mapping/normalizeConditions";

const CONFIG = {
  task: "Задача",
  position: "Теги",
  demand: "Количество вакансий",
  date: "Обновлено",
  status: "Статус",
  metro: "Метро",
  schedule: "График",
  nightShift: "Ночной формат работы",
  unloading: "Разгрузка",
};

/** Конфиг без колонок условий — таким он был до миграции 20260807100100. */
const CONFIG_WITHOUT_CONDITIONS = {
  task: "Задача",
  position: "Теги",
  demand: "Количество вакансий",
  date: "Обновлено",
  status: "Статус",
};

const HEADERS = [
  "Приоритет",
  "Задача",
  "Статус",
  "Теги",
  "Обновлено",
  "Количество вакансий",
  "Метро",
  "График",
  "Ночной формат работы",
  "Разгрузка",
];

type SheetRow = {
  task: string;
  status: string;
  position: string;
  date: Date;
  demand?: string;
  metro?: string;
  schedule?: string;
  nightShift?: string;
  unloading?: string;
};

function makeWorkbook(rows: SheetRow[]): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sheet0");
  sheet.addRow(HEADERS);
  for (const row of rows) {
    sheet.addRow([
      "Средний",
      row.task,
      row.status,
      row.position,
      row.date,
      row.demand ?? null,
      row.metro ?? null,
      row.schedule ?? null,
      row.nightShift ?? null,
      row.unloading ?? null,
    ]);
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
        conditions: EMPTY_CONDITIONS,
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

/**
 * Выгрузка от 27.08.2026: Tracker отдал другой набор колонок — без «Теги» и
 * «Количество вакансий», зато с «Тип»/«Ключ»/«Исполнитель»/«Резолюция»/
 * «Родительский тикет»/«Время смены». До этого такой файл отклонялся целиком
 * («Файл не соответствует ожидаемому формату проекта»), хотя должность в нём
 * есть — внутри «Задачи».
 */
describe("parserLavkaV1 — выгрузка без «Теги» и «Количество вакансий»", () => {
  const HEADERS_2708 = [
    "Приоритет",
    "Тип",
    "Ключ",
    "Задача",
    "Исполнитель",
    "Статус",
    "Резолюция",
    "Обновлено",
    "Родительский тикет",
    "График",
    "Время смены",
    "Разгрузка",
    "Ночной формат работы",
    "Метро",
  ];

  function makeWorkbook2708(rows: { task: string; status: string; date: Date; schedule?: string }[]): ExcelJS.Workbook {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sheet0");
    sheet.addRow(HEADERS_2708);
    for (const row of rows) {
      sheet.addRow([
        "Средний",
        "Задача",
        "LPD-22385",
        row.task,
        "Сергей Абалмасов(abalmasov-st)",
        row.status,
        null,
        row.date,
        null,
        row.schedule ?? null,
        "7:00-16:00",
        "Да",
        "Нет",
        "Юго-западная",
      ]);
    }
    return workbook;
  }

  it("canParse is true even without «Теги» и «Количество вакансий»", () => {
    expect(parserLavkaV1.canParse(makeWorkbook2708([]), CONFIG)).toBe(true);
  });

  it("takes the position out of «Задача» when the «Теги» column is missing", () => {
    const workbook = makeWorkbook2708([
      {
        task: "Москва | Вакансия Кладовщик для площадки: МСК Академика Анохина, 2к1Б (супермаркет 4) | 2024120501",
        status: "Готов к выходу",
        date: new Date("2026-08-27T00:00:00Z"),
      },
    ]);
    const { rows, errors } = parserLavkaV1.extractRows(workbook, CONFIG, "Яндекс Лавка");
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({
      city: "Москва",
      address: "МСК Академика Анохина, 2к1Б (супермаркет 4)",
      position: "Кладовщик",
      demand: "1",
    });
  });

  it.each([
    ["Москва | Вакансия Сборщик для площадки: МСК Домодедово, Рабочая 50а | 2023072601", "Сборщик"],
    ["Москва | Вакансия КГЕ для площадки: МСК Зорге, 18к2 (Дарккитчен 6) | 2025041101", "КГЕ"],
    ["Москва | Вакансия Мобильный КГЕ для площадки: МСК Зорге, 18к2 | 2025041102", "Мобильный КГЕ"],
  ])("reads a multi-word position out of «%s»", (task, expected) => {
    const { rows } = parserLavkaV1.extractRows(
      makeWorkbook2708([{ task, status: "Открыт", date: new Date("2026-08-27T00:00:00Z") }]),
      CONFIG,
      "Яндекс Лавка",
    );
    expect(rows[0]!.position).toBe(expected);
  });

  it("reports a clear row error when neither «Теги» nor «Задача» yields a position", () => {
    const workbook = makeWorkbook2708([
      { task: "Москва | что-то для площадки: МСК Ленина, 1 | 123", status: "Открыт", date: new Date("2026-08-27T00:00:00Z") },
    ]);
    const { rows, errors } = parserLavkaV1.extractRows(workbook, CONFIG, "Яндекс Лавка");
    expect(rows).toEqual([]);
    expect(errors[0]!.reason).toContain("Не удалось определить должность");
  });

  it("still prefers «Теги» when that column is present", () => {
    // «Задача» говорит «Кладовщик», «Теги» — «Сборщик»: выигрывает колонка.
    const workbook = makeWorkbook([
      {
        task: "Москва | Вакансия Кладовщик для площадки: МСК Снежная, 20 | 123",
        status: "Открыт",
        position: "Сборщик",
        date: new Date("2026-08-27T00:00:00Z"),
      },
    ]);
    const { rows } = parserLavkaV1.extractRows(workbook, CONFIG, "Яндекс Лавка");
    expect(rows[0]!.position).toBe("Сборщик");
  });

  it("collects every schedule of the row into conditions.scheduleTypes", () => {
    const workbook = makeWorkbook2708([
      {
        task: "Москва | Вакансия Кладовщик для площадки: МСК Ленина, 1 | 123",
        status: "Открыт",
        date: new Date("2026-08-27T00:00:00Z"),
        schedule: "5/2-6/1",
      },
    ]);
    const { rows } = parserLavkaV1.extractRows(workbook, CONFIG, "Яндекс Лавка");
    expect(rows[0]!.conditions!.scheduleTypes).toEqual(["5/2", "6/1"]);
    expect(rows[0]!.conditions!.scheduleType).toBe("5/2");
  });

  it("does not care about column order — headers are matched by name", () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sheet0");
    // Тот же набор колонок, но в обратном порядке.
    sheet.addRow([...HEADERS_2708].reverse());
    const reversedRow = [
      "Юго-западная",
      "Нет",
      "Да",
      "7:00-16:00",
      "5/2",
      null,
      new Date("2026-08-27T00:00:00Z"),
      null,
      "Открыт",
      "Сергей Абалмасов(abalmasov-st)",
      "Москва | Вакансия Курьер для площадки: МСК Ленина, 1 | 123",
      "LPD-1",
      "Задача",
      "Средний",
    ];
    sheet.addRow(reversedRow);

    expect(parserLavkaV1.canParse(workbook, CONFIG)).toBe(true);
    const { rows, errors } = parserLavkaV1.extractRows(workbook, CONFIG, "Яндекс Лавка");
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({
      city: "Москва",
      address: "МСК Ленина, 1",
      position: "Курьер",
      date: "2026-08-27",
    });
    expect(rows[0]!.conditions!.metro).toBe("Юго-западная");
    expect(rows[0]!.conditions!.scheduleTypes).toEqual(["5/2"]);
  });
});

describe("parserLavkaV1 — условия работы", () => {
  const baseRow: SheetRow = {
    task: "Москва | Вакансия Кладовщик для площадки: МСК Снежная, 20 | 123",
    status: "Открыт",
    position: "Кладовщик",
    date: new Date("2026-07-31T00:00:00Z"),
  };

  it("reads metro, schedule, night flag and unloading into the row's conditions", () => {
    const workbook = makeWorkbook([
      { ...baseRow, metro: "Владыкино", schedule: "5\\2", nightShift: "Да", unloading: "Да" },
    ]);
    const { rows } = parserLavkaV1.extractRows(workbook, CONFIG, "Лавка");
    expect(rows[0]!.conditions).toEqual({
      metro: "Владыкино",
      scheduleType: "5/2",
      scheduleTypes: ["5/2"],
      shiftType: "night",
      features: ["unloading"],
    });
  });

  it("leaves out the unloading feature when the column says Нет", () => {
    const workbook = makeWorkbook([{ ...baseRow, unloading: "Нет", nightShift: "Нет" }]);
    const { rows } = parserLavkaV1.extractRows(workbook, CONFIG, "Лавка");
    expect(rows[0]!.conditions!.features).toEqual([]);
    expect(rows[0]!.conditions!.shiftType).toBe("day");
  });

  it("still parses when the condition columns are absent from the config", () => {
    const workbook = makeWorkbook([{ ...baseRow, metro: "Владыкино", schedule: "5/2" }]);
    const { rows, errors } = parserLavkaV1.extractRows(workbook, CONFIG_WITHOUT_CONDITIONS, "Лавка");
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.conditions).toEqual(EMPTY_CONDITIONS);
  });

  it("canParse does not require the optional condition columns", () => {
    const workbook = new ExcelJS.Workbook();
    workbook
      .addWorksheet("Sheet0")
      .addRow(["Задача", "Статус", "Теги", "Обновлено", "Количество вакансий"]);
    expect(parserLavkaV1.canParse(workbook, CONFIG)).toBe(true);
  });
});
