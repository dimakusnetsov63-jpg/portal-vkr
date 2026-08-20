import { createClient } from "./client";
import type {
  QualityAnswer,
  QualityGroupReportRow,
  QualityChecklistRow,
  QualityChecklistTree,
  QualityGroupRow,
  QualityItemRow,
  QualityKind,
  QualityReportRow,
  QualityReviewFilters,
  QualityReviewRow,
  QualityReviewWithScores,
  QualityScoreRow,
} from "./quality.types";

/**
 * Слой доступа к данным раздела «Контроль качества» (TASK-013).
 *
 * Два отличия от остальных репозиториев портала, оба намеренные:
 *
 * 1. **Серверная пагинация.** `listReviews` отдаёт страницу и общее число
 *    строк, а не весь реестр: в исходной таблице за один июнь 2026 — 2765
 *    проверок. Загружать это в браузер целиком (как делают «Кандидаты», см.
 *    BLOCK-2 в backlog) значило бы повторить известную ошибку в новом коде.
 *
 * 2. **Запись проверок только через RPC.** У `quality_reviews` нет
 *    INSERT/UPDATE-политик и грантов вовсе — `portal_save_quality_review`
 *    пересчитывает проценты по ответам и пишет их сама. Прямой upsert из
 *    браузера позволил бы прислать любой итог мимо проставленных баллов.
 *    Шаблоны, наоборот, редактируются обычным CRUD: у них нет производных
 *    значений.
 */

/** Форма jsonb-колонки `group_scores` — см. quality.types.ts. */
function asReviewRow(row: unknown): QualityReviewRow {
  return row as QualityReviewRow;
}

/** Активные шаблоны, свежие сверху. Архивные не отдаются — они не выбираются в форме. */
export async function listChecklists(): Promise<QualityChecklistRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("quality_checklists")
    .select("*")
    .is("archived_at", null)
    .order("kind", { ascending: true })
    .order("project", { ascending: true, nullsFirst: true });
  if (error) throw error;
  return data;
}

/**
 * Шаблон целиком: блоки в порядке `sort_order`, пункты внутри блока — тоже.
 * Архивные блоки и пункты не отдаются: заполнять по ним новую проверку
 * нельзя, а старые проверки читают свои ответы напрямую по `item_id`.
 */
export async function getChecklistTree(checklistId: string): Promise<QualityChecklistTree> {
  const supabase = createClient();

  const [checklistResult, groupsResult, itemsResult] = await Promise.all([
    supabase.from("quality_checklists").select("*").eq("id", checklistId).single(),
    supabase
      .from("quality_checklist_groups")
      .select("*")
      .eq("checklist_id", checklistId)
      .is("archived_at", null)
      .order("sort_order", { ascending: true }),
    supabase
      .from("quality_checklist_items")
      .select("*, quality_checklist_groups!inner(checklist_id)")
      .eq("quality_checklist_groups.checklist_id", checklistId)
      .is("archived_at", null)
      .order("sort_order", { ascending: true }),
  ]);

  if (checklistResult.error) throw checklistResult.error;
  if (groupsResult.error) throw groupsResult.error;
  if (itemsResult.error) throw itemsResult.error;

  const items = itemsResult.data as unknown as QualityItemRow[];
  const byGroup = new Map<string, QualityItemRow[]>();
  for (const item of items) {
    const list = byGroup.get(item.group_id);
    if (list) list.push(item);
    else byGroup.set(item.group_id, [item]);
  }

  return {
    checklist: checklistResult.data,
    groups: (groupsResult.data as QualityGroupRow[]).map((group) => ({
      group,
      items: byGroup.get(group.id) ?? [],
    })),
  };
}

/**
 * Подбор шаблона под проверку: сначала шаблон проекта, при его отсутствии —
 * общий шаблон вида (`project is null`). Это правило живёт здесь, а не в
 * базе: оно про удобство ввода, а не про целостность данных.
 */
export function pickChecklist(
  checklists: QualityChecklistRow[],
  kind: QualityKind,
  project: string,
): QualityChecklistRow | null {
  const ofKind = checklists.filter((item) => item.kind === kind);
  return ofKind.find((item) => item.project === project) ?? ofKind.find((item) => item.project === null) ?? null;
}

export interface ReviewsPage {
  rows: QualityReviewRow[];
  total: number;
}

/** Страница реестра проверок. `limit`/`offset` — обязательны осознанно: способа «загрузить всё» здесь нет. */
export async function listReviews(
  filters: QualityReviewFilters,
  limit: number,
  offset: number,
): Promise<ReviewsPage> {
  const supabase = createClient();
  let query = supabase.from("quality_reviews").select("*", { count: "exact" });

  if (filters.project) query = query.eq("project", filters.project);
  if (filters.employeeName) query = query.eq("employee_name", filters.employeeName);
  if (filters.kind) query = query.eq("kind", filters.kind);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.dateFrom) query = query.gte("review_date", filters.dateFrom);
  if (filters.dateTo) query = query.lte("review_date", filters.dateTo);
  if (filters.onlyCases) query = query.eq("is_case", true);
  // Архивные скрыты по умолчанию: ошибочная проверка не должна попадаться
  // на глаза в реестре, но и теряться совсем не должна.
  query = filters.showArchived ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  if (filters.search) {
    const term = filters.search.trim();
    // Числовой поиск — это номер лида; всё остальное ищется по сотруднику.
    // `or` с ilike по employee_name и точным совпадением crm_lead_id: искать
    // «3660718» подстрокой в bigint PostgREST не умеет, да и не нужно.
    query = /^\d+$/.test(term)
      ? query.eq("crm_lead_id", Number(term))
      : query.ilike("employee_name", `%${term}%`);
  }

  const { data, error, count } = await query
    .order("review_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return { rows: (data ?? []).map(asReviewRow), total: count ?? 0 };
}

/** Проверка вместе с ответами — для карточки и для повторного открытия формы. */
export async function getReview(reviewId: string): Promise<QualityReviewWithScores> {
  const supabase = createClient();
  const [reviewResult, scoresResult] = await Promise.all([
    supabase.from("quality_reviews").select("*").eq("id", reviewId).single(),
    supabase.from("quality_review_scores").select("*").eq("review_id", reviewId),
  ]);
  if (reviewResult.error) throw reviewResult.error;
  if (scoresResult.error) throw scoresResult.error;
  return {
    review: asReviewRow(reviewResult.data),
    scores: scoresResult.data as QualityScoreRow[],
  };
}

/** Прошлые проверки того же лида — для предупреждения «этот лид уже проверяли». */
export async function findReviewsByLead(crmLeadId: number, excludeReviewId?: string): Promise<QualityReviewRow[]> {
  const supabase = createClient();
  let query = supabase.from("quality_reviews").select("*").eq("crm_lead_id", crmLeadId);
  if (excludeReviewId) query = query.neq("id", excludeReviewId);

  const { data, error } = await query.order("review_date", { ascending: false }).limit(5);
  if (error) throw error;
  return (data ?? []).map(asReviewRow);
}

/**
 * Ошибка одновременного редактирования: кто-то сохранил эту проверку,
 * пока её держали открытой. Отдельный класс, а не разбор текста ошибки в
 * компоненте — интерфейсу нужно предложить перечитать данные, а не просто
 * показать сообщение. Тот же приём, что у вакансий.
 */
export class QualityVersionConflictError extends Error {
  constructor() {
    super("Кто-то уже изменил эту проверку. Обновите данные и повторите правку.");
    this.name = "QualityVersionConflictError";
  }
}

export interface SaveReviewInput {
  reviewId?: string | null;
  /** Версия строки на момент открытия. Обязательна при правке — см. B3. */
  expectedVersion?: number | null;
  checklistId: string;
  kind: QualityKind;
  crmLeadId: number;
  project: string;
  employeeName: string;
  employeeUserId?: string | null;
  reviewerName?: string | null;
  reviewDate?: string | null;
  callDate?: string | null;
  callType?: string | null;
  position?: string | null;
  city?: string | null;
  objection?: string | null;
  crmComment?: string | null;
  handlingSpeed?: string | null;
  outboundCalls?: number | null;
  isTarget?: boolean | null;
  violation?: string | null;
  recommendations?: string | null;
  isCase?: boolean;
  caseComment?: string | null;
  status?: "draft" | "completed";
  answers: QualityAnswer[];
}

export interface SaveReviewResult {
  id: string;
  version: number;
  total_score: number | null;
  group_scores: Record<string, number | null>;
  has_critical: boolean;
}

/**
 * Сохраняет проверку целиком. Итог приходит из базы — здесь он не считается
 * и не отправляется: `qualityScore.ts` нужен форме для превью, но записанное
 * значение всегда то, что посчитал `portal_save_quality_review`.
 */
export async function saveReview(input: SaveReviewInput): Promise<SaveReviewResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("portal_save_quality_review", {
    p_review_id: input.reviewId ?? null,
    p_expected_version: input.expectedVersion ?? undefined,
    p_payload: {
      checklist_id: input.checklistId,
      kind: input.kind,
      crm_lead_id: input.crmLeadId,
      project: input.project,
      employee_name: input.employeeName,
      employee_user_id: input.employeeUserId ?? null,
      reviewer_name: input.reviewerName ?? null,
      review_date: input.reviewDate ?? null,
      call_date: input.callDate ?? null,
      call_type: input.callType ?? null,
      position: input.position ?? null,
      city: input.city ?? null,
      objection: input.objection ?? null,
      crm_comment: input.crmComment ?? null,
      handling_speed: input.handlingSpeed ?? null,
      outbound_calls: input.outboundCalls ?? null,
      is_target: input.isTarget ?? null,
      violation: input.violation ?? null,
      recommendations: input.recommendations ?? null,
      is_case: input.isCase ?? false,
      case_comment: input.caseComment ?? null,
      status: input.status ?? "completed",
      scores: input.answers.map((answer) => ({
        item_id: answer.itemId,
        value: answer.value,
        is_na: answer.isNa,
        note: answer.note ?? null,
      })),
    },
  } as never);

  if (error) {
    if (error.message?.includes("version_conflict")) throw new QualityVersionConflictError();
    throw error;
  }
  return data as unknown as SaveReviewResult;
}

/** Сводка за период. Агрегат считает база — см. комментарий у RPC. */
export async function loadReport(
  from: string,
  to: string,
  project?: string,
  kind?: QualityKind,
): Promise<QualityReportRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("portal_quality_report", {
    p_from: from,
    p_to: to,
    p_project: project ?? undefined,
    p_kind: kind ?? undefined,
  } as never);
  if (error) throw error;
  return (data ?? []) as unknown as QualityReportRow[];
}

/**
 * Разрез сводки по блокам чек-листа — «Сводная по рекрутерам» из Excel.
 *
 * Отдельный агрегат, а не разбор `group_scores` на клиенте: раскрывать
 * jsonb в браузере пришлось бы по всем строкам периода, то есть сначала
 * загрузить их все — ровно то, чего раздел избегает серверной пагинацией.
 */
export async function loadReportByGroup(
  from: string,
  to: string,
  project?: string,
  kind?: QualityKind,
  employeeName?: string,
): Promise<QualityGroupReportRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("portal_quality_report_by_group", {
    p_from: from,
    p_to: to,
    p_project: project ?? undefined,
    p_kind: kind ?? undefined,
    p_employee: employeeName ?? undefined,
  } as never);
  if (error) throw error;
  return (data ?? []) as unknown as QualityGroupReportRow[];
}

/**
 * Убирает проверку из работы и из отчётности либо возвращает обратно.
 *
 * Отдельная RPC, а не UPDATE из браузера: у `quality_reviews` нет
 * UPDATE-гранта вовсе, и появляться ему нельзя — иначе тем же путём можно
 * было бы переписать `total_score` мимо расчёта (ADR-006).
 */
export async function setReviewArchived(reviewId: string, archived: boolean): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("portal_archive_quality_review", {
    p_review_id: reviewId,
    p_archived: archived,
  } as never);
  if (error) throw error;
}
