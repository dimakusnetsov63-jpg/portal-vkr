import type { StaffingDemandHistoryAction } from "@/lib/supabase/staffingDemandHistory.types";

const ACTION_LABELS: Record<StaffingDemandHistoryAction, string> = {
  insert: "Создано",
  update: "Изменено",
  delete: "Удалено",
};

export function describeAction(action: StaffingDemandHistoryAction): string {
  return ACTION_LABELS[action];
}

function formatQuantityValue(value: number | null): string {
  return value === null ? "—" : String(value);
}

/** "было → стало" for a quantity history entry; null renders as "—" (not set / cleared). */
export function formatQuantityChange(oldQuantity: number | null, newQuantity: number | null): string {
  return `${formatQuantityValue(oldQuantity)} → ${formatQuantityValue(newQuantity)}`;
}

function shortenUserId(id: string): string {
  return `Пользователь ${id.slice(0, 8)}…`;
}

/**
 * Display label for who made a change. There is no profiles table in this
 * project, so a name can only be resolved for the current user's own
 * changes (compared against their session id, shown via their known
 * email); anyone else's changes fall back to a shortened id.
 */
export function resolveChangedByLabel(
  changedBy: string | null,
  currentUserId: string | null,
  currentUserEmail: string | null,
): string {
  if (!changedBy) return "Неизвестно";
  if (currentUserId && changedBy === currentUserId) {
    return currentUserEmail ?? shortenUserId(changedBy);
  }
  return shortenUserId(changedBy);
}
