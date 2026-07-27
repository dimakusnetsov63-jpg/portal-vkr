import type { DemandGroupedProject } from "./demandAggregate";

export type DemandRowStatus = "active" | "paused" | "closed";

export const DEMAND_ROW_STATUSES: DemandRowStatus[] = ["active", "paused", "closed"];

export const DEMAND_ROW_STATUS_LABELS: Record<DemandRowStatus, string> = {
  active: "Активна",
  paused: "На паузе",
  closed: "Закрыта",
};

export function isDemandRowStatus(value: string): value is DemandRowStatus {
  return (DEMAND_ROW_STATUSES as string[]).includes(value);
}

export const DEMAND_COMMENT_MAX_LENGTH = 2000;

/** Trims the comment and turns an empty result into null — never persist "" as a value. */
export function normalizeComment(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

export function isCommentTooLong(raw: string): boolean {
  return raw.trim().length > DEMAND_COMMENT_MAX_LENGTH;
}

/**
 * Stable composite key for (project, city, position) — for use as a Map/Set
 * key. Uses JSON.stringify rather than a delimiter-joined string (e.g.
 * `${a} ${b} ${c}`) so that distinct triples can never collide by having the
 * delimiter appear inside one of the values.
 */
export function demandRowMetaKey(project: string, city: string, position: string): string {
  return JSON.stringify([project, city, position]);
}

export interface DemandRowMetaValue {
  status: DemandRowStatus;
  comment: string | null;
}

interface DemandRowMetaLike {
  project: string;
  city: string;
  position: string;
  status: string;
  comment: string | null;
}

/** Looks up a row's metadata; absence of a record means "active, no comment" — the UI default. */
export function getRowMeta(
  metaList: DemandRowMetaLike[],
  project: string,
  city: string,
  position: string,
): DemandRowMetaValue {
  const found = metaList.find((m) => m.project === project && m.city === city && m.position === position);
  if (!found) return { status: "active", comment: null };
  return {
    status: isDemandRowStatus(found.status) ? found.status : "active",
    comment: found.comment,
  };
}

/**
 * Merges a partial patch ({status?, comment?}) with the row's existing
 * metadata (or the "active, no comment" default when there is none) so an
 * update to one field never clobbers the other: updating only `status`
 * leaves `comment` untouched, and vice versa.
 */
export function mergeRowMetaPatch(
  existing: DemandRowMetaValue | undefined,
  patch: { status?: DemandRowStatus; comment?: string | null },
): DemandRowMetaValue {
  return {
    status: patch.status ?? existing?.status ?? "active",
    comment: patch.comment !== undefined ? patch.comment : (existing?.comment ?? null),
  };
}

/** Keeps only rows where the (project, city, position) row-level status matches `rowStatus`. Empty/no filter keeps everything. */
export function filterGroupsByRowStatus(
  grouped: DemandGroupedProject[],
  metaList: DemandRowMetaLike[],
  rowStatus: DemandRowStatus | "",
): DemandGroupedProject[] {
  if (!rowStatus) return grouped;
  return grouped
    .map((g) => ({
      project: g.project,
      cities: g.cities
        .map((c) => ({
          city: c.city,
          positions: c.positions.filter(
            (position) => getRowMeta(metaList, g.project, c.city, position).status === rowStatus,
          ),
        }))
        .filter((c) => c.positions.length > 0),
    }))
    .filter((g) => g.cities.length > 0);
}
