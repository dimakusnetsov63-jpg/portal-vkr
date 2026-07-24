/** What committing a cell's draft input should do to the underlying record. */
export type CellCommitAction =
  | { type: "noop" }
  | { type: "upsert"; value: number }
  | { type: "delete" };

const INTEGER_PATTERN = /^\d+$/;

/**
 * Decides what an inline-edit commit should do, given the raw input text and
 * the cell's previously saved value (null = no row yet).
 *
 * - Empty input clears an existing value (delete); on an already-empty cell
 *   it's a no-op.
 * - `0` is treated the same as "no need" and is never persisted as its own
 *   row: typing 0 over an existing value deletes it, typing 0 over an empty
 *   cell is a no-op.
 * - Negative numbers, decimals and free text are rejected (no-op, no save —
 *   the caller reverts to the previous displayed value).
 * - Anything else unchanged from the previous value is a no-op (nothing to
 *   save).
 */
export function resolveCellCommit(raw: string, previous: number | null): CellCommitAction {
  const trimmed = raw.trim();

  if (trimmed === "") {
    return previous === null ? { type: "noop" } : { type: "delete" };
  }

  if (!INTEGER_PATTERN.test(trimmed)) return { type: "noop" };

  const parsed = Number(trimmed);

  if (parsed === 0) {
    return previous === null || previous === 0 ? { type: "noop" } : { type: "delete" };
  }

  if (parsed === previous) return { type: "noop" };

  return { type: "upsert", value: parsed };
}
