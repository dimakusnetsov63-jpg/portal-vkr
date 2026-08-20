import type { QualityGroupScores, QualityScoreRow } from "@/lib/supabase/quality.types";

/**
 * Сборка проверки для показа — из её собственных ответов, а не из текущего
 * шаблона.
 *
 * Почему так (B2 аудита, BUG-02). Раньше карточка обходила дерево шаблона и
 * брала оттуда формулировки и порядок. Заархивировали пункт — ответ на него
 * исчезал из прошлых проверок; переименовали — в прошлой проверке менялся
 * текст вопроса. Оценка при этом оставалась прежней, а её обоснование
 * уезжало. Для раздела, где оценку оспаривают, это подрывает
 * доказательность.
 *
 * Теперь каждая строка ответа несёт снимок: формулировку пункта, блок, к
 * которому он относился, и оба порядковых номера. Этого достаточно, чтобы
 * нарисовать проверку целиком, ни разу не заглянув в шаблон.
 */

export interface SnapshotItem {
  itemId: string;
  title: string;
  value: number | null;
  isNa: boolean;
  note: string | null;
}

export interface SnapshotGroup {
  groupId: string;
  title: string;
  /** Процент блока из снимка проверки; `null` — считать было не из чего. */
  percent: number | null;
  items: SnapshotItem[];
}

/**
 * Группирует ответы по блокам в том порядке, в каком они стояли на момент
 * сохранения. Проценты подставляются из `group_scores` той же проверки.
 */
export function buildReviewSnapshot(scores: QualityScoreRow[], groupScores: QualityGroupScores): SnapshotGroup[] {
  const groups = new Map<string, SnapshotGroup & { sortOrder: number; itemOrder: Map<string, number> }>();

  for (const score of scores) {
    let group = groups.get(score.group_id);
    if (!group) {
      group = {
        groupId: score.group_id,
        title: score.group_title,
        percent: groupScores[score.group_id] ?? null,
        items: [],
        sortOrder: score.group_sort_order,
        itemOrder: new Map(),
      };
      groups.set(score.group_id, group);
    }

    group.items.push({
      itemId: score.item_id,
      title: score.item_title,
      value: score.value,
      isNa: score.is_na,
      note: score.note,
    });
    group.itemOrder.set(score.item_id, score.item_sort_order);
  }

  return [...groups.values()]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((group) => ({
      groupId: group.groupId,
      title: group.title,
      percent: group.percent,
      items: [...group.items].sort(
        (a, b) => (group.itemOrder.get(a.itemId) ?? 0) - (group.itemOrder.get(b.itemId) ?? 0),
      ),
    }));
}

/** Ответ в том виде, в каком его читает человек. */
export function formatAnswer(item: SnapshotItem): string {
  if (item.isNa) return "н/д";
  if (item.value === null) return "—";
  if (item.value === 0) return "Нет";
  if (item.value === 1) return "Частично";
  return "Да";
}
