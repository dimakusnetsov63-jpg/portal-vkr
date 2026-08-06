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
    zeroed_rows: 0,
    status: "success",
    duration_ms: 100,
    error_log: [],
    warnings: [],
    ...overrides,
  };
}

describe("canRevertImport", () => {
  it("allows revert for an import that only created new cards", () => {
    expect(canRevertImport(makeImport({ mode: "replace", updated_rows: 0, new_rows: 10 }))).toBe(true);
    expect(canRevertImport(makeImport({ mode: "add", updated_rows: 0, new_rows: 10 }))).toBe(true);
  });

  it("blocks revert once the import overwrote an existing card's required_count", () => {
    expect(canRevertImport(makeImport({ mode: "replace", updated_rows: 5 }))).toBe(false);
    expect(canRevertImport(makeImport({ mode: "add", updated_rows: 3 }))).toBe(false);
  });

  it("blocks revert for a sync import that zeroed cards — their previous value is not kept", () => {
    expect(canRevertImport(makeImport({ mode: "sync", updated_rows: 0, zeroed_rows: 4 }))).toBe(false);
  });

  it("allows revert for a sync import that happened to zero nothing", () => {
    expect(canRevertImport(makeImport({ mode: "sync", updated_rows: 0, zeroed_rows: 0 }))).toBe(true);
  });

  it("blocks revert for an already-reverted import", () => {
    expect(canRevertImport(makeImport({ status: "reverted" }))).toBe(false);
  });

  it("blocks revert for a dry-run import", () => {
    expect(canRevertImport(makeImport({ dry_run: true }))).toBe(false);
  });
});
