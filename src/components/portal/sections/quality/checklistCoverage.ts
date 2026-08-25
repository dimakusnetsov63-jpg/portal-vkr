import type { QualityChecklistRow, QualityKind } from "@/lib/supabase/quality.types";

/**
 * Кто каким шаблоном пользуется — по видам проверки и проектам.
 *
 * Нужно потому, что связь «проект → шаблон» неочевидна: у проекта либо есть
 * свой чек-лист, либо работает общий, либо нет ничего и проверку по этому
 * проекту не завести. По списку шаблонов этого не видно — там перечислены
 * шаблоны, а вопрос у человека обратный: «а по «Купер» проверка вообще
 * заполнится?».
 *
 * Поводом стал разбор реального случая: единственный общий чек-лист звонка
 * переназначили на один проект, и двадцать остальных молча остались без
 * шаблона. Заметить это было негде.
 */

export interface KindCoverage {
  kind: QualityKind;
  /** Есть общий шаблон вида (`project is null`). */
  hasCommon: boolean;
  /** Проекты со своим шаблоном — он всегда важнее общего. */
  own: string[];
  /** Проекты без своего шаблона, работающие по общему. */
  fallback: string[];
  /** Проекты, по которым проверку завести нельзя: нет ни своего шаблона, ни общего. */
  missing: string[];
}

/**
 * Архивные шаблоны не участвуют: они не подбираются под проверку. Проекты
 * берутся из общего справочника портала — того же, что в остальных разделах.
 */
export function checklistCoverage(
  checklists: QualityChecklistRow[],
  projects: string[],
  kinds: QualityKind[] = ["call", "refusal"],
): KindCoverage[] {
  const active = checklists.filter((row) => row.archived_at === null);

  return kinds.map((kind) => {
    const ofKind = active.filter((row) => row.kind === kind);
    const hasCommon = ofKind.some((row) => row.project === null);
    const owned = new Set(
      ofKind.map((row) => row.project).filter((project): project is string => project !== null),
    );

    const own: string[] = [];
    const fallback: string[] = [];
    const missing: string[] = [];

    for (const project of projects) {
      if (owned.has(project)) own.push(project);
      else if (hasCommon) fallback.push(project);
      else missing.push(project);
    }

    return { kind, hasCommon, own, fallback, missing };
  });
}
