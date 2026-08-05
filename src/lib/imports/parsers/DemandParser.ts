import type ExcelJS from "exceljs";
import type { RawImportRow } from "../validateRow";
import type { ColumnMapping } from "../types";
import type { RowError } from "../types";

/**
 * One implementation per distinct Excel structure. Registered in
 * parserRegistry by `parserKey`, not by project name — a project's
 * `parser_key` lives in `project_import_configs` and can be swapped to a new
 * version (e.g. "lavka_v2") without touching this interface or any other
 * parser.
 *
 * A parser only extracts raw cell text into `RawImportRow`s — it does not
 * validate city/position dictionaries or dates itself. That validation is
 * centralized in `validateRow`/`importDemand.ts`, which is the only place
 * that knows the current candidate_list_options dictionaries; duplicating
 * that lookup per-parser would make every new parser implementation carry
 * the same validation logic.
 */
export interface DemandParser {
  /** Matches project_import_configs.parser_key — how parserRegistry finds this implementation. */
  readonly parserKey: string;
  /** Cheap structural check (e.g. required headers present) — used to fail fast with a clear error before attempting a full parse. */
  canParse(workbook: ExcelJS.Workbook, config: ColumnMapping): boolean;
  /** `project` comes from the UI's project selector, not from the file — every row of a single import belongs to one project. */
  extractRows(
    workbook: ExcelJS.Workbook,
    config: ColumnMapping,
    project: string,
  ): { rows: RawImportRow[]; errors: RowError[] };
}
