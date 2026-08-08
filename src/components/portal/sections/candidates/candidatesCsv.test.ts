import { describe, expect, it } from "vitest";
import type { Candidate } from "@/lib/supabase/candidates.types";
import { buildCandidatesCsv } from "./candidatesCsv";

/** Build a valid Candidate row; override only the fields a test cares about. */
function makeCandidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: "id-1",
    external_id: null,
    full_name: "Иван Иванов",
    project: "Самокат",
    city: null,
    position: null,
    stage: null,
    recruiter: null,
    manager: null,
    coordinator: null,
    source: null,
    phone: null,
    telegram_tag: null,
    max_tag: null,
    comment: null,
    has_medical_book: null,
    salary_card: null,
    invitation_at: null,
    registration_at: null,
    first_shift_at: null,
    termination_reason: null,
    terminated_at: null,
    return_reason: null,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    archived_at: null,
    ...overrides,
  };
}

function rows(csv: string): string[] {
  return csv.split("\n");
}

/**
 * Разбивает CSV на записи с учётом кавычек (RFC 4180): перевод строки внутри
 * кавычек — часть значения, а не граница записи. Наивный `split("\n")`
 * (см. `rows`) для этого не годится — им нельзя проверить, что реальный
 * потребитель CSV (Excel) увидит правильное число строк.
 */
function csvRecordCount(csv: string): number {
  let count = 1;
  let inQuotes = false;
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === "\n" && !inQuotes) count++;
  }
  return count;
}

describe("buildCandidatesCsv — заголовок и базовая форма", () => {
  it("первая строка — заголовок из 15 колонок в кавычках", () => {
    const csv = buildCandidatesCsv([]);
    expect(rows(csv)).toEqual([
      '"ФИО";"External ID";"Проект";"Город";"Должность";"Стадия";"Рекрутер";"Менеджер";"Координатор";"Телефон";"Telegram";"MAX";"Медкнижка";"1-я смена";"Архивирован"',
    ]);
  });

  it("обычная строка без спецсимволов сохраняет значения как есть, в кавычках", () => {
    const csv = buildCandidatesCsv([makeCandidate({ full_name: "Иван Иванов", project: "Самокат", city: "Москва" })]);
    const [, dataRow] = rows(csv);
    expect(dataRow).toBe('"Иван Иванов";"";"Самокат";"Москва";"";"";"";"";"";"";"";"";"Не указано";"";"нет"');
  });
});

describe("buildCandidatesCsv — формульная инъекция (H-4)", () => {
  it.each(['=HYPERLINK("https://evil/","Open")', "+1+1", "-1+1", "@SUM(1,1)", "\tformula", "\rformula"])(
    "значение, начинающееся с %s, экспортируется с апострофом-префиксом (первый символ поля в кавычках — ')",
    (dangerous) => {
      const csv = buildCandidatesCsv([makeCandidate({ full_name: dangerous })]);
      const [, dataRow] = rows(csv);
      // Первое поле — full_name; экранирование кавычек внутри не должно мешать
      // проверке апострофа-guard'а сразу после открывающей кавычки поля.
      expect(dataRow.startsWith('"\'')).toBe(true);
    },
  );

  it("безопасное значение не получает апостроф", () => {
    const csv = buildCandidatesCsv([makeCandidate({ full_name: "Обычное имя" })]);
    const [, dataRow] = rows(csv);
    expect(dataRow.startsWith('"Обычное имя"')).toBe(true);
  });
});

describe("buildCandidatesCsv — поломка структуры (H-4)", () => {
  it("точка с запятой в значении не сдвигает колонки — поле в кавычках", () => {
    const csv = buildCandidatesCsv([makeCandidate({ full_name: "Иванов; Пётр", project: "Проект" })]);
    const [, dataRow] = rows(csv);
    expect(dataRow).toBe('"Иванов; Пётр";"";"Проект";"";"";"";"";"";"";"";"";"";"Не указано";"";"нет"');
  });

  it("кавычка внутри значения удваивается", () => {
    const csv = buildCandidatesCsv([makeCandidate({ full_name: 'Иван "Ваня" Иванов' })]);
    const [, dataRow] = rows(csv);
    expect(dataRow.startsWith('"Иван ""Ваня"" Иванов"')).toBe(true);
  });

  it("перевод строки внутри значения не создаёт лишнюю запись CSV", () => {
    const csv = buildCandidatesCsv([makeCandidate({ full_name: "Строка1\nСтрока2" }), makeCandidate({ full_name: "Второй кандидат" })]);
    // 1 заголовок + 2 кандидата = 3 записи для настоящего CSV-парсера, даже
    // если внутри одного значения есть \n — поле в кавычках защищает его.
    expect(csvRecordCount(csv)).toBe(3);
    expect(csv).toContain('"Строка1\nСтрока2"');
  });
});

describe("buildCandidatesCsv — производные поля", () => {
  it("медкнижка форматируется через medicalBookLabel", () => {
    const csv = buildCandidatesCsv([makeCandidate({ has_medical_book: true })]);
    expect(csv).toContain('"Есть"');
  });

  it("архивный кандидат отмечен 'да' в последней колонке", () => {
    const csv = buildCandidatesCsv([makeCandidate({ archived_at: "2026-08-01T00:00:00.000Z" })]);
    const [, dataRow] = rows(csv);
    expect(dataRow.endsWith('"да"')).toBe(true);
  });
});
