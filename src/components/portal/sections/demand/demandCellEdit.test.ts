import { describe, expect, it } from "vitest";
import { resolveCellCommit } from "./demandCellEdit";

describe("resolveCellCommit", () => {
  it("deletes when clearing an existing value", () => {
    expect(resolveCellCommit("", 5)).toEqual({ type: "delete" });
  });

  it("no-ops when clearing an already-empty cell", () => {
    expect(resolveCellCommit("", null)).toEqual({ type: "noop" });
  });

  it("no-ops when typing 0 over an already-empty cell", () => {
    expect(resolveCellCommit("0", null)).toEqual({ type: "noop" });
  });

  it("no-ops when typing 0 over an already-zero cell", () => {
    expect(resolveCellCommit("0", 0)).toEqual({ type: "noop" });
  });

  it("deletes when typing 0 over a non-zero value (0 is never persisted)", () => {
    expect(resolveCellCommit("0", 7)).toEqual({ type: "delete" });
  });

  it("upserts a valid positive integer", () => {
    expect(resolveCellCommit("12", null)).toEqual({ type: "upsert", value: 12 });
    expect(resolveCellCommit("12", 5)).toEqual({ type: "upsert", value: 12 });
  });

  it("no-ops when the value is unchanged", () => {
    expect(resolveCellCommit("5", 5)).toEqual({ type: "noop" });
  });

  it("rejects negative numbers (no-op, revert)", () => {
    expect(resolveCellCommit("-3", 5)).toEqual({ type: "noop" });
  });

  it("rejects decimals (no-op, revert)", () => {
    expect(resolveCellCommit("3.5", 5)).toEqual({ type: "noop" });
  });

  it("rejects free text (no-op, revert)", () => {
    expect(resolveCellCommit("abc", 5)).toEqual({ type: "noop" });
  });

  it("rejects whitespace-only input the same as empty", () => {
    expect(resolveCellCommit("   ", 5)).toEqual({ type: "delete" });
  });
});
