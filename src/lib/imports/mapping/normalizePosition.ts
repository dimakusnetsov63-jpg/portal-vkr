/** Matches a raw Excel cell value against the known position dictionary (candidate_list_options, list_type=position), trimmed + case-insensitive. Returns the canonical known value, or null if the position is unknown. */
export function normalizePosition(raw: string, knownPositions: readonly string[]): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const match = knownPositions.find((position) => position.toLowerCase() === trimmed.toLowerCase());
  return match ?? null;
}
