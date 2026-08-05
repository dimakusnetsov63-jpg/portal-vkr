import { describe, expect, it } from "vitest";
import { canRevertImport } from "./revertImport";
import type { StaffingDemandImportRow } from "../supabase/staffingDemandImports.types";

function makeImport(overrides: Partial<StaffingDemandImportRow> = {}): StaffingDemandImportRow {
  return {
    id: "import-1",
    created_at: "2026-08-05T10:00:00Z",
    created_by: "user-1",
    created_by_login: "head",
    project: "Лавка",
    parser_key: "lavka_v1",
    parser_version: 1,
    file_name: "lavka.xlsx",
    mode: "replace",
    dry_run: false,
    total_rows: 10,
    imported_rows: 10,
    error_rows: 0,
    new_rows: 10,
    updated_rows: 0,
    status: "success",
    duration_ms: 100,
    error_log: [],
    warnings: [],
    ...overrides,
  };
}

describe("canRevertImport", () => {
  it("allows revert for a replace-mode import", () => {
    expect(canRevertImport(makeImport({ mode: "replace", updated_rows: 5 }))).toBe(true);
  });

  it("allows revert for an add-mode import that only created new rows", () => {
    expect(canRevertImport(makeImport({ mode: "add", updated_rows: 0, new_rows: 10 }))).toBe(true);
  });

  it("blocks revert for an add-mode import that also updated existing rows", () => {
    expect(canRevertImport(makeImport({ mode: "add", updated_rows: 3 }))).toBe(false);
  });

  it("blocks revert for an already-reverted import", () => {
    expect(canRevertImport(makeImport({ status: "reverted" }))).toBe(false);
  });

  it("blocks revert for a dry-run import", () => {
    expect(canRevertImport(makeImport({ dry_run: true }))).toBe(false);
  });
});
