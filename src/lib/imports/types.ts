import type { ImportedConditions } from "./mapping/normalizeConditions";
import type { ImportPreviewAction, ImportPreviewRow } from "./preview";

export type { ImportedConditions, ImportPreviewAction, ImportPreviewRow };

/** Единый внутренний формат строки потребности — выход любого парсера, независимо от структуры исходного Excel. */
export type DemandImportRow = {
  project: string;
  city: string;
  position: string;
  date: string;
  demand: number;
  address: string | null;
  /** Условия работы на объекте (метро, график, смена, особенности), если файл проекта их содержит. У «плоских» выгрузок остаются пустыми. */
  conditions: ImportedConditions;
};

/** One row's rejection, surfaced to the user in the preview/report — never thrown as an exception. */
export type RowError = {
  /** Номер строки в исходном листе Excel (1-based, включая заголовок), для сообщения пользователю. */
  rowNumber: number;
  reason: string;
};

/** What a parser (or the shared validation step) produced from one Excel file: the rows that made it through, plus every row that didn't. */
export type ParseResult = {
  rows: DemandImportRow[];
  errors: RowError[];
};

/**
 * Конфигурация парсера для проекта — хранится в
 * project_import_configs.column_mapping (jsonb), поэтому типизирована как
 * произвольный словарь "поле → заголовок колонки в Excel". Каждый
 * `DemandParser` сам документирует, какие ключи ему нужны:
 * `genericColumnParser.ts` ожидает {city, address, position, demand, date}
 * (заголовки совпадают буквально с колонками единого формата),
 * `parser_lavka.ts` — другой набор ключей под реальную структуру выгрузки
 * из Yandex Tracker (см. комментарий в файле). Общей строгой формы нет
 * специально: у каждого проекта свой Excel, и вычислять из него единый
 * формат может требовать разного набора исходных колонок.
 */
export type ColumnMapping = Record<string, string>;

/**
 * `replace` — «Требуется» карточки перезаписывается числом из файла;
 * `add` — число из файла прибавляется к текущему;
 * `sync` — как `replace`, плюс карточки проекта, которых в файле нет,
 * обнуляются (выгрузка показывает только открытые позиции, поэтому
 * закрытый объект из неё просто исчезает — см. requirements/addresses.md).
 */
export type ImportMode = "replace" | "add" | "sync";

/** Итог одного вызова importDemand() — что показать в UI (предпросмотр/dry-run или финальный отчёт после реальной записи). */
export type ImportReport = {
  fileName: string;
  project: string;
  parserKey: string;
  parserVersion: number;
  mode: ImportMode;
  dryRun: boolean;
  totalRows: number;
  importedRows: number;
  errorRows: number;
  newRows: number;
  updatedRows: number;
  /** Сколько карточек обнулено как отсутствующие в файле — всегда 0 вне режима `sync`. */
  zeroedRows: number;
  durationMs: number;
  errors: RowError[];
  warnings: string[];
  /** Что именно изменится (или изменилось) в public.addresses — по одной строке на карточку, для предпросмотра перед реальной записью. */
  preview: ImportPreviewRow[];
  /** Дата потребности, выбранная пользователем в форме — не читается из файла (см. ImportDemandInput.demandDate). */
  demandDate: string;
  /** Заполняется только для реального (не dry-run) импорта — id записи в staffing_demand_imports. */
  importId: string | null;
};
