import type ExcelJS from "exceljs";
import type { RawImportRow } from "../validateRow";
import type { ColumnMapping, RowError } from "../types";
import type { DemandParser } from "./DemandParser";

/**
 * Fully generic implementation of `DemandParser`: every column name it looks
 * for comes from `config` (project_import_configs.column_mapping), never
 * hardcoded here. Used as a stand-in for БК/Газпром/Купер until real sample
 * files for those projects are available — each currently points at this
 * same parser with an identical column mapping (see the migration's seed
 * data). «Лавка» has since moved off this parser onto its own dedicated
 * implementation (`parser_lavka.ts`), because its real Excel format (a
 * Yandex Tracker ticket export) doesn't fit "one row = one flat
 * city/address/position/date/demand record" at all. When one of the
 * remaining projects' real format is known, either point its config at a
 * different `column_mapping` (if its structure does fit the flat shape) or
 * add a new `DemandParser` implementation and register it — this file does
 * not change either way.
 */
export function makeGenericColumnParser(parserKey: string): DemandParser {
  return {
    parserKey,
    canParse(workbook, config) {
      const sheet = workbook.worksheets[0];
      if (!sheet) return false;
      const headers = headerIndex(sheet.getRow(1));
      return Object.values(config).every((header) => headers.has(header));
    },
    extractRows(workbook, config, project) {
      return extract(workbook, config, project);
    },
  };
}

function headerIndex(headerRow: ExcelJS.Row): Map<string, number> {
  const index = new Map<string, number>();
  headerRow.eachCell((cell, colNumber) => {
    index.set(String(cell.value ?? "").trim(), colNumber);
  });
  return index;
}

function extract(
  workbook: ExcelJS.Workbook,
  config: ColumnMapping,
  project: string,
): { rows: RawImportRow[]; errors: RowError[] } {
  const sheet = workbook.worksheets[0];
  if (!sheet) return { rows: [], errors: [{ rowNumber: 0, reason: "В файле нет ни одного листа" }] };

  const headers = headerIndex(sheet.getRow(1));
  const columnIndexByField = new Map<keyof ColumnMapping, number>();
  for (const field of Object.keys(config) as (keyof ColumnMapping)[]) {
    const colNumber = headers.get(config[field]);
    if (colNumber !== undefined) columnIndexByField.set(field, colNumber);
  }

  const missing = (Object.keys(config) as (keyof ColumnMapping)[]).filter((field) => !columnIndexByField.has(field));
  if (missing.length > 0) {
    return {
      rows: [],
      errors: [{ rowNumber: 1, reason: `Отсутствуют обязательные столбцы: ${missing.map((f) => config[f]).join(", ")}` }],
    };
  }

  const rows: RawImportRow[] = [];
  const lastRow = sheet.rowCount;
  for (let rowNumber = 2; rowNumber <= lastRow; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    const cell = (field: keyof ColumnMapping) => String(row.getCell(columnIndexByField.get(field)!).value ?? "").trim();
    rows.push({
      rowNumber,
      project,
      city: cell("city"),
      address: cell("address"),
      position: cell("position"),
      date: formatDateCell(row.getCell(columnIndexByField.get("date")!).value),
      demand: cell("demand"),
    });
  }

  return { rows, errors: [] };
}

function formatDateCell(value: ExcelJS.CellValue): string {
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return String(value ?? "").trim();
}
