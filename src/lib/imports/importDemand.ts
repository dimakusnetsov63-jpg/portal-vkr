import { readWorkbook } from "./excel/readWorkbook";
import { getParserByKey } from "./parsers/parserRegistry";
import { validateRow } from "./validateRow";
import type { DemandImportRow, ImportMode, ImportReport } from "./types";
import { getImportConfigForProject } from "../supabase/projectImportConfigsRepo";
import { createImportRecord } from "../supabase/staffingDemandImportsRepo";
import {
  bulkInsertAddressesFromImport,
  bulkUpdateAddressesFromImport,
  listActiveAddressesForProject,
} from "../supabase/addressesRepo";
import { aggregateByObject, planAddressWrites } from "./addressPlan";

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
 * project's registered parser → validate every row → aggregate into one
 * entry per staffing object → (dry-run: stop here) → match against existing
 * address cards → create/update them → record history.
 *
 * The result of an import is rows in **public.addresses** («Адреса»), not in
 * public.staffing_demand: one card per (project, city, full_address,
 * position), with `required_count` = how many people that object needs. For
 * ticket-shaped sources like «Яндекс Лавка» one open ticket = one required
 * person, so several tickets on the same object/position are summed. The
 * ticket's own date is deliberately not part of the key — an address card
 * has no date dimension (see docs/requirements/addresses.md).
 *
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
      if ("error" in result) {
        errors.push(result.error);
        continue;
      }
      // Карточка адреса не может существовать без адреса (full_address NOT
      // NULL) — в отличие от строки матрицы «Потребность», где адрес был
      // необязателен.
      if (!result.row.address) {
        errors.push({ rowNumber: raw.rowNumber, reason: "Не указан адрес — карточку объекта создать не из чего" });
        continue;
      }
      rows.push(result.row);
    }
    if (i + CHUNK_SIZE < extracted.rows.length) await yieldToUi();
  }

  const warnings: string[] = [];
  const objects = aggregateByObject(rows);
  if (objects.length < rows.length) {
    warnings.push(
      `${rows.length} строк(и) файла сведены в ${objects.length} объект(ов): строки с одинаковым проектом, городом, адресом и должностью объединены, их потребность сложена (один открытый тикет = один требуемый человек)`,
    );
  }

  // В режиме «Синхронизировать» карточки нужны всегда — даже если из файла
  // не пришло ни одного объекта, ведь именно тогда обнулять придётся всё.
  const needsExistingCards = objects.length > 0 || input.mode === "sync";
  const existingCards = needsExistingCards ? await listActiveAddressesForProject(input.project) : [];
  const plan = planAddressWrites(objects, existingCards, input.mode, input.project);

  if (plan.skippedManual > 0) {
    warnings.push(
      `${plan.skippedManual} карточек(и) проекта не обнулены: они заведены вручную, а не импортом — файл для них не источник истины. При необходимости поправьте «Требуется» в карточке адреса`,
    );
  }

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
    newRows: plan.creates.length,
    updatedRows: plan.updates.length,
    zeroedRows: plan.zeroes.length,
    durationMs: Date.now() - startedAt,
    errors,
    warnings,
    preview: plan.preview,
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
    zeroed_rows: report.zeroedRows,
    status: errors.length === 0 ? "success" : rows.length === 0 ? "failed" : "partial",
    duration_ms: report.durationMs,
    error_log: errors,
    warnings,
  });

  await bulkInsertAddressesFromImport(plan.creates, record.id);
  await bulkUpdateAddressesFromImport([...plan.updates, ...plan.zeroes]);

  return { ...report, importId: record.id };
}
