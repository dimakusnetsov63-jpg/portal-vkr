/** Matches a raw Excel cell value against the known city dictionary (candidate_list_options, list_type=city), trimmed + case-insensitive. Returns the canonical known value, or null if the city is unknown. */
export function normalizeCity(raw: string, knownCities: readonly string[]): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const match = knownCities.find((city) => city.toLowerCase() === trimmed.toLowerCase());
  return match ?? null;
}
