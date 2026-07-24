/**
 * URL-restorable state for the "Потребность" section.
 *
 * `status`/`active` (from the full ТЗ) are added in a later stage, once the
 * `status` column exists — see demand/README.md. This stage covers the
 * fields that don't depend on it.
 */
export interface DemandUrlState {
  section: string;
  project: string;
  city: string;
  q: string;
  filled: boolean;
  from: string;
  to: string;
}

/** Builds a URLSearchParams from whichever fields are set (falsy/empty values are omitted, not written as empty). */
export function serializeDemandParams(state: Partial<DemandUrlState>): URLSearchParams {
  const params = new URLSearchParams();
  if (state.section) params.set("section", state.section);
  if (state.project) params.set("project", state.project);
  if (state.city) params.set("city", state.city);
  if (state.q) params.set("q", state.q);
  if (state.filled) params.set("filled", "1");
  if (state.from) params.set("from", state.from);
  if (state.to) params.set("to", state.to);
  return params;
}

/** Reads whichever demand fields are present in the params. Missing fields are omitted from the result (not defaulted). */
export function parseDemandParams(params: URLSearchParams): Partial<DemandUrlState> {
  const result: Partial<DemandUrlState> = {};
  const section = params.get("section");
  if (section) result.section = section;
  const project = params.get("project");
  if (project) result.project = project;
  const city = params.get("city");
  if (city) result.city = city;
  const q = params.get("q");
  if (q) result.q = q;
  const filled = params.get("filled");
  if (filled !== null) result.filled = filled === "1" || filled === "true";
  const from = params.get("from");
  if (from) result.from = from;
  const to = params.get("to");
  if (to) result.to = to;
  return result;
}
