import type { Database } from "./database.types";

/**
 * Типы раздела «Контроль качества» (TASK-013).
 *
 * Пять таблиц: шаблон (`quality_checklists`) → блок
 * (`quality_checklist_groups`) → пункт (`quality_checklist_items`), и
 * отдельно заполненная проверка (`quality_reviews`) с ответами по пунктам
 * (`quality_review_scores`).
 *
 * ⚠️ Миграции `20260818100000`…`20260818100700` к боевой БД **не
 * применялись**, а `database.types.ts` для них правился руками (штатная
 * `supabase gen types` требует применённой схемы). После применения типы
 * нужно регенерировать и сверить — пункт зафиксирован в
 * `docs/database/migrations.md` и в `docs/tasks/current.md`.
 *
 * `group_scores` в сгенерированном типе — `Json` (так типизируется любая
 * jsonb-колонка). Приложение всегда читает оттуда одну форму
 * «id блока → процент или null», поэтому `QualityReviewRow` переопределяет
 * это поле поверх сгенерированного — тот же приём, что у
 * `rates.extras` и `addresses.document_links`.
 */

type ChecklistsTable = Database["public"]["Tables"]["quality_checklists"];
type GroupsTable = Database["public"]["Tables"]["quality_checklist_groups"];
type ItemsTable = Database["public"]["Tables"]["quality_checklist_items"];
type ReviewsTable = Database["public"]["Tables"]["quality_reviews"];
type ScoresTable = Database["public"]["Tables"]["quality_review_scores"];

/** Вид проверки: чек-лист звонка целиком или проверка лида с самоотказом. */
export type QualityKind = "call" | "refusal";

/**
 * Шкала пункта. `yes_no` — не оценка, а переключатель блока: отвечает на
 * вопрос «возражение было?» и при «Нет» выключает весь свой блок.
 */
export type QualityItemScale = "0-1-2" | "0-2" | "yes_no";

export type QualityCallType = "incoming" | "outgoing" | "no_answer";

export type QualityReviewStatus = "draft" | "completed";

/** Проценты по блокам на момент сохранения: id блока → процент или null. */
export type QualityGroupScores = Record<string, number | null>;

export type QualityChecklistRow = ChecklistsTable["Row"];
export type QualityChecklistInsert = ChecklistsTable["Insert"];
export type QualityChecklistUpdate = ChecklistsTable["Update"];

export type QualityGroupRow = GroupsTable["Row"];
export type QualityGroupInsert = GroupsTable["Insert"];
export type QualityGroupUpdate = GroupsTable["Update"];

export type QualityItemRow = ItemsTable["Row"];
export type QualityItemInsert = ItemsTable["Insert"];
export type QualityItemUpdate = ItemsTable["Update"];

export type QualityReviewRow = Omit<ReviewsTable["Row"], "group_scores"> & {
  group_scores: QualityGroupScores;
};

export type QualityScoreRow = ScoresTable["Row"];

/** Шаблон целиком — то, с чем работает и форма проверки, и редактор шаблонов. */
export interface QualityChecklistTree {
  checklist: QualityChecklistRow;
  groups: Array<{
    group: QualityGroupRow;
    items: QualityItemRow[];
  }>;
}

/** Ответ по одному пункту в форме проверки. */
export interface QualityAnswer {
  itemId: string;
  /** 0/1/2; у переключателя 1 = «Да», 0 = «Нет». null — пункт не заполнен. */
  value: number | null;
  isNa: boolean;
  note?: string | null;
}

/** Проверка вместе с ответами — то, что открывается в карточке. */
export interface QualityReviewWithScores {
  review: QualityReviewRow;
  scores: QualityScoreRow[];
}

/** Фильтры реестра. Пустое поле = «не фильтровать». */
export interface QualityReviewFilters {
  project?: string;
  employeeName?: string;
  kind?: QualityKind;
  status?: QualityReviewStatus;
  dateFrom?: string;
  dateTo?: string;
  onlyCases?: boolean;
  search?: string;
}

/** Строка сводки из `portal_quality_report`. */
export interface QualityReportRow {
  employee_name: string;
  project: string;
  reviews_count: number;
  avg_total: number | null;
  cases_count: number;
  critical_count: number;
}
