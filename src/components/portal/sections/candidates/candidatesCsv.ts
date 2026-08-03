import type { Candidate } from "@/lib/supabase/candidates.types";
import { medicalBookLabel } from "@/lib/portal/candidateOptions";
import { fmtDateTime } from "@/lib/portal/format";

/**
 * Экранирование одного поля CSV (находка H-4).
 *
 * Два независимых риска:
 * 1. **Формульная инъекция.** Значение, начинающееся с `= + - @` или табом/CR,
 *    Excel и LibreOffice трактуют как формулу — заполняется рекрутёрами
 *    вручную, содержимое не контролируется. Префикс апострофом заставляет
 *    таблицу показать значение как текст.
 * 2. **Поломка структуры.** Разделитель `;`, кавычка или перевод строки в
 *    значении сдвигают колонки. RFC 4180: оборачивать в кавычки, внутренние
 *    кавычки — удваивать.
 *
 * Апостроф добавляется **до** оборачивания в кавычки, чтобы его тоже защитило
 * экранирование, если в значении и так была ведущая кавычка.
 */
const FORMULA_PREFIX_RE = /^[=+\-@\t\r]/;

function escapeCsvField(value: string): string {
  const withFormulaGuard = FORMULA_PREFIX_RE.test(value) ? `'${value}` : value;
  return `"${withFormulaGuard.replace(/"/g, '""')}"`;
}

const HEADER = [
  "ФИО",
  "External ID",
  "Проект",
  "Город",
  "Должность",
  "Стадия",
  "Рекрутер",
  "Менеджер",
  "Координатор",
  "Телефон",
  "Telegram",
  "MAX",
  "Медкнижка",
  "1-я смена",
  "Архивирован",
];

function candidateRow(c: Candidate): string[] {
  return [
    c.full_name,
    c.external_id ?? "",
    c.project,
    c.city ?? "",
    c.position ?? "",
    c.stage ?? "",
    c.recruiter ?? "",
    c.manager ?? "",
    c.coordinator ?? "",
    c.phone ?? "",
    c.telegram_tag ?? "",
    c.max_tag ?? "",
    medicalBookLabel(c.has_medical_book),
    c.first_shift_at ? (fmtDateTime(new Date(c.first_shift_at)) ?? "") : "",
    c.archived_at ? "да" : "нет",
  ];
}

/**
 * Собирает CSV реестра кандидатов. Чистая функция — то же содержимое строк,
 * что и раньше, только безопасно экранированное; формат вывода (порядок
 * колонок, разделитель `;`) не менялся.
 */
export function buildCandidatesCsv(candidates: Candidate[]): string {
  const lines = [HEADER, ...candidates.map(candidateRow)].map((row) => row.map(escapeCsvField).join(";"));
  return lines.join("\n");
}
