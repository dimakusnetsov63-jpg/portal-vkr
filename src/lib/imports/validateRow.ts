import { normalizeCity } from "./mapping/normalizeCity";
import { normalizePosition } from "./mapping/normalizePosition";
import type { DemandImportRow, RowError } from "./types";

/** Raw cell values extracted by a parser for one Excel row, before validation/normalization — everything is still text. */
export type RawImportRow = {
  rowNumber: number;
  project: string;
  city: string;
  position: string;
  date: string;
  demand: string;
  address: string;
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Parses a date cell into an ISO "YYYY-MM-DD" string. Accepts ISO input as-is and common ru-RU "ДД.ММ.ГГГГ" input; anything else is rejected rather than guessed. */
function parseDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (ISO_DATE_RE.test(trimmed)) return trimmed;
  const ruMatch = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (ruMatch) {
    const [, day, month, year] = ruMatch;
    return `${year}-${month}-${day}`;
  }
  return null;
}

/**
 * Validates and normalizes one raw parsed row into the unified DemandImportRow
 * format, or returns the reason it was rejected. Never throws — every failure
 * mode from ТЗ §7 (missing columns, empty row, bad date, negative demand,
 * unknown city/position) is reported back as a RowError, not an exception.
 */
export function validateRow(
  raw: RawImportRow,
  knownCities: readonly string[],
  knownPositions: readonly string[],
): { row: DemandImportRow } | { error: RowError } {
  const project = raw.project.trim();
  if (!project) {
    return { error: { rowNumber: raw.rowNumber, reason: "Не указан проект" } };
  }

  if (!raw.city.trim() && !raw.position.trim() && !raw.date.trim() && !raw.demand.trim()) {
    return { error: { rowNumber: raw.rowNumber, reason: "Пустая строка" } };
  }

  const city = normalizeCity(raw.city, knownCities);
  if (!city) {
    return { error: { rowNumber: raw.rowNumber, reason: `Неизвестный город: «${raw.city.trim()}»` } };
  }

  const position = normalizePosition(raw.position, knownPositions);
  if (!position) {
    return { error: { rowNumber: raw.rowNumber, reason: `Неизвестная должность: «${raw.position.trim()}»` } };
  }

  const date = parseDate(raw.date);
  if (!date) {
    return { error: { rowNumber: raw.rowNumber, reason: `Некорректная дата: «${raw.date.trim()}»` } };
  }

  const demandText = raw.demand.trim();
  const demand = Number(demandText);
  if (!demandText || !Number.isFinite(demand) || !Number.isInteger(demand)) {
    return { error: { rowNumber: raw.rowNumber, reason: `Некорректная потребность: «${demandText}»` } };
  }
  if (demand < 0) {
    return { error: { rowNumber: raw.rowNumber, reason: "Потребность не может быть отрицательной" } };
  }

  const address = raw.address.trim() || null;

  return { row: { project, city, position, date, demand, address } };
}
