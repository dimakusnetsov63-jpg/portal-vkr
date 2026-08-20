import { parseLeadId } from "./qualityScore";

/**
 * Валидация формы проверки.
 *
 * Вынесено из `ReviewFormModal` не ради чистоты структуры: правила жили
 * внутри `submit()` и потому не покрывались ни одним тестом (TD-01 аудита).
 * Форма — единственное место, где проверяющий вводит данные, и молчаливая
 * ошибка здесь стоит дороже, чем в любом другом узле раздела.
 *
 * Здесь только то, что можно решить, глядя на введённое. Всё, что зависит
 * от состояния базы — доступ к проекту, версия строки, полнота ответов —
 * проверяет `portal_save_quality_review`, и клиентская проверка её не
 * заменяет, а лишь избавляет человека от лишнего запроса.
 */

export interface ReviewFormValues {
  project: string;
  leadInput: string;
  employeeName: string;
  outboundCalls: string;
}

export interface ReviewFormContext {
  /** Найден ли шаблон под выбранные вид и проект. */
  hasChecklist: boolean;
  /** Сколько пунктов осталось без ответа. */
  unanswered: number;
  status: "draft" | "completed";
}

export type ReviewFormValidation =
  | { ok: true; leadId: number; employeeName: string }
  | { ok: false; message: string };

/**
 * Первая непройденная проверка и останавливает: показывать список из пяти
 * замечаний на форме, где поля идут сверху вниз, незачем — человек всё
 * равно чинит их по одному.
 */
export function validateReviewForm(values: ReviewFormValues, context: ReviewFormContext): ReviewFormValidation {
  if (!context.hasChecklist) {
    return { ok: false, message: "Не найден шаблон проверки для этого проекта и вида" };
  }

  if (!values.project.trim()) {
    return { ok: false, message: "Выберите проект" };
  }

  const leadId = parseLeadId(values.leadInput);
  if (leadId === null) {
    return { ok: false, message: "Укажите номер лида или вставьте ссылку на него" };
  }

  // Та же нормализация, что делает база при записи: край обрезан, пробелы
  // внутри схлопнуты. Иначе «  » прошло бы как непустое имя.
  const employeeName = values.employeeName.replace(/\s+/g, " ").trim();
  if (!employeeName) {
    return { ok: false, message: "Укажите сотрудника, чью работу проверяли" };
  }

  if (values.outboundCalls !== "") {
    const calls = Number(values.outboundCalls);
    if (!Number.isInteger(calls) || calls < 0) {
      return { ok: false, message: "Счётчик исходящих звонков — целое число, не меньше нуля" };
    }
  }

  // Завершить проверку с пропусками нельзя — это правило базы (BUG-01
  // аудита), здесь оно повторено, чтобы человек увидел причину до отправки.
  // Черновик неполным быть вправе.
  if (context.status === "completed" && context.unanswered > 0) {
    return {
      ok: false,
      message: `Заполнены не все пункты: осталось ${context.unanswered}. Сохраните черновик или ответьте на оставшиеся.`,
    };
  }

  return { ok: true, leadId, employeeName };
}
