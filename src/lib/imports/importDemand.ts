import { readWorkbook } from "./excel/readWorkbook";
import { getParserByKey } from "./parsers/parserRegistry";
import { validateRow } from "./validateRow";
import type { DemandImportRow, ImportMode, ImportReport } from "./types";
import { getImportConfigForProject } from "../supabase/projectImportConfigsRepo";
import { createImportRecord } from "../supabase/staffingDemandImportsRepo";
import {
  bulkUpsertStaffingDemandFromImport,
  getStaffingDemandForProjectDates,
} from "../supabase/staffingDemandRepo";

/** Everything importDemand() needs from the caller — the UI supplies the file/mode/dryRun choices, and the already-loaded candidate_list_options dictionaries and current-user identity, so this module never talks to those directly. */
export type ImportDemandInput = {
  project: string;
  file: File;
  mode: ImportMode;
  dryRun: boolean;
  knownCities: readonly string[];
  knownPositions: readonly string[];
  actor: { id: string; login: string };
};

const CHUNK_SIZE = 1000;

/** Yields control back to the event loop between chunks so a 10k-row file doesn't block the UI thread — ТЗ §"Требования к производительности". */
function yieldToUi(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Orchestrates one Excel import end to end: read workbook → run the
 * project's registered parser → validate every row → (dry-run: stop here) →
 * diff against existing rows for "Добавить" → batch-write → record history.
 * Never throws for row-level problems — those surface as `report.errors`;
 * it only throws for structural failures (unreadable file, no parser
 * configured, DB error) that abort the whole import.
 */
export async function importDemand(input: ImportDemandInput): Promise<ImportReport> {
  const startedAt = Date.now();
  const config = await getImportConfigForProject(input.project);
  const parser = getParserByKey(config.parser_key);

  const workbook = await readWorkbook(input.file);
  if (!parser.canParse(workbook, config.column_mapping)) {
    throw new Error(`Файл не соответствует ожидаемому формату проекта «${input.project}»`);
  }

  const extracted = parser.extractRows(workbook, config.column_mapping, input.project);
  const rows: DemandImportRow[] = [];
  const errors = [...extracted.errors];

  for (let i = 0; i < extracted.rows.length; i += CHUNK_SIZE) {
    const chunk = extracted.rows.slice(i, i + CHUNK_SIZE);
    for (const raw of chunk) {
      const result = validateRow(raw, input.knownCities, input.knownPositions);
      if ("error" in result) errors.push(result.error);
      else rows.push(result.row);
    }
    if (i + CHUNK_SIZE < extracted.rows.length) await yieldToUi();
  }

  const warnings: string[] = [];
  const aggregated = aggregateDuplicateKeys(rows);
  if (aggregated.length < rows.length) {
    warnings.push(
      `${rows.length - aggregated.length} строк(и) объединены: несколько строк файла указывали одну и ту же ячейку (проект+город+должность+дата+адрес) — потребность из них сложена. Так устроены, например, выгрузки тикетов, где один тикет = одна вакантная позиция (см. parser_lavka.ts)`,
    );
  }
  const { newRows, updatedRows, writes } = await diffAgainstExisting(input.project, aggregated, input.mode);

  const report: ImportReport = {
    fileName: input.file.name,
    project: input.project,
    parserKey: parser.parserKey,
    parserVersion: config.version,
    mode: input.mode,
    dryRun: input.dryRun,
    totalRows: extracted.rows.length,
    importedRows: rows.length,
    errorRows: errors.length,
    newRows,
    updatedRows,
    durationMs: Date.now() - startedAt,
    errors,
    warnings,
    importId: null,
  };

  if (input.dryRun) return report;

  const record = await createImportRecord({
    created_by: input.actor.id,
    created_by_login: input.actor.login,
    project: input.project,
    parser_key: parser.parserKey,
    parser_version: config.version,
    file_name: input.file.name,
    mode: input.mode,
    dry_run: false,
    total_rows: report.totalRows,
    imported_rows: report.importedRows,
    error_rows: report.errorRows,
    new_rows: report.newRows,
    updated_rows: report.updatedRows,
    status: errors.length === 0 ? "success" : rows.length === 0 ? "failed" : "partial",
    duration_ms: report.durationMs,
    error_log: errors,
    warnings,
  });

  if (writes.length > 0) {
    await bulkUpsertStaffingDemandFromImport(writes.map((w) => ({ ...w, import_id: record.id })));
  }

  return { ...report, importId: record.id };
}

/**
 * For mode "Заменить" every valid row is written as-is (planned_count = row.demand).
 * For mode "Добавить" the existing planned_count for the same key is needed,
 * and the new value is existing + demand. Existing rows are fetched with one
 * query filtered only by `project` + the (few, low-cardinality) dates in the
 * file — see getStaffingDemandForProjectDates's doc comment for why a
 * per-row OR-of-five-fields filter doesn't work with real data — then
 * matched against each row's full key (city/position/address) in memory.
 */
async function diffAgainstExisting(
  project: string,
  rows: DemandImportRow[],
  mode: ImportMode,
): Promise<{
  newRows: number;
  updatedRows: number;
  writes: { project: string; city: string; position: string; demand_date: string; address: string | null; planned_count: number }[];
}> {
  if (rows.length === 0) return { newRows: 0, updatedRows: 0, writes: [] };

  const existing = await getStaffingDemandForProjectDates(project, rows.map((row) => row.date));
  const existingByKey = new Map(existing.map((row) => [rowKey(row.project, row.city, row.position, row.demand_date, row.address), row]));

  let newRows = 0;
  let updatedRows = 0;
  const writes = rows.map((row) => {
    const key = rowKey(project, row.city, row.position, row.date, row.address);
    const existingRow = existingByKey.get(key);
    if (existingRow) updatedRows++;
    else newRows++;
    const plannedCount = mode === "add" && existingRow ? existingRow.planned_count + row.demand : row.demand;
    return {
      project,
      city: row.city,
      position: row.position,
      demand_date: row.date,
      address: row.address,
      planned_count: plannedCount,
    };
  });

  return { newRows, updatedRows, writes };
}

function rowKey(project: string, city: string, position: string, date: string, address: string | null): string {
  return `${project} ${city} ${position} ${date} ${address ?? ""}`;
}

/**
 * Sums `demand` for rows sharing the same (city, position, date, address)
 * key. Required before writing: a single Supabase `.upsert()` call cannot
 * touch the same conflict key twice (Postgres error 21000, "ON CONFLICT DO
 * UPDATE command cannot affect row a second time") — a real scenario for
 * sources like parser_lavka.ts, where several open tickets can land on the
 * same address/position/day.
 */
function aggregateDuplicateKeys(rows: DemandImportRow[]): DemandImportRow[] {
  const byKey = new Map<string, DemandImportRow>();
  for (const row of rows) {
    const key = rowKey(row.project, row.city, row.position, row.date, row.address);
    const existing = byKey.get(key);
    if (existing) existing.demand += row.demand;
    else byKey.set(key, { ...row });
  }
  return [...byKey.values()];
}
