import type {
  QualityCallType,
  QualityChecklistRow,
  QualityItemScale,
  QualityKind,
} from "@/lib/supabase/quality.types";

/** Подписи, форматтеры и правила показа раздела «Контроль качества». */

export const QUALITY_KINDS: QualityKind[] = ["call", "refusal"];

/**
 * Названия видов проверки — те, которыми пользуется команда: «прослушка КЦ»
 * и «прослушка самоотказов». Внутренние коды (`call`/`refusal`) остаются
 * прежними: переименовывать значения в базе ради подписи незачем.
 */
export const KIND_LABELS: Record<QualityKind, string> = {
  call: "Прослушка КЦ",
  refusal: "Прослушка самоотказов",
};

export const CALL_TYPES: QualityCallType[] = ["outgoing", "incoming", "no_answer"];

export const CALL_TYPE_LABELS: Record<QualityCallType, string> = {
  outgoing: "Исходящий",
  incoming: "Входящий",
  no_answer: "Недозвон",
};

export const STATUS_LABELS: Record<string, string> = {
  draft: "Черновик",
  completed: "Завершена",
};

/**
 * Шкала в базе — text + CHECK (а не enum, чтобы список расширялся без
 * `ALTER TYPE`), поэтому в сгенерированных типах это просто `string`.
 * Сужение до литералов делается здесь, на границе приложения — тот же
 * приём, что `AddressStatus` в addresses.types.ts. Неизвестное значение
 * трактуется как полная шкала: показать три кнопки вместо двух безопаснее,
 * чем уронить форму.
 */
export function asItemScale(value: string): QualityItemScale {
  return value === "0-2" || value === "yes_no" ? value : "0-1-2";
}

/** Варианты ответа для шкалы пункта. Порядок — от худшего к лучшему. */
export function scaleValues(scale: QualityItemScale): number[] {
  if (scale === "yes_no") return [0, 1];
  if (scale === "0-2") return [0, 2];
  return [0, 1, 2];
}

export function scaleValueLabel(scale: QualityItemScale, value: number): string {
  if (scale === "yes_no") return value === 1 ? "Да" : "Нет";
  if (value === 0) return "Нет";
  if (value === 1) return "Частично";
  return "Да";
}

/**
 * Базовый адрес CRM. Вынесен в константу, а не разбросан по компоненту:
 * в базе хранится только номер лида, ссылка собирается при показе. Смена
 * адреса CRM — правка одной строки, а не миграция всех строк (в исходных
 * таблицах лежал полный URL, и это была бы именно миграция).
 */
export const CRM_LEAD_URL_BASE = "https://portal.sth-group.ru/crm/lead/details";

export function leadUrl(crmLeadId: number): string {
  return `${CRM_LEAD_URL_BASE}/${crmLeadId}/`;
}

/** Процент к показу: `null` — «считать было не из чего», это не ноль. */
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${Number.isInteger(value) ? value : value.toFixed(2)}%`;
}

/** Тон бейджа по итогу проверки — пороги согласованы с бизнесом как рабочие ориентиры. */
export function scoreTone(value: number | null | undefined): "green" | "amber" | "red" | "gray" {
  if (value === null || value === undefined) return "gray";
  if (value >= 90) return "green";
  if (value >= 70) return "amber";
  return "red";
}

/**
 * Варианты поля справочника вместе с уже сохранённым значением.
 *
 * Списки в форме собираются из **активных** записей справочника. Без этой
 * добавки значение, которое с тех пор отключили, пропадает из `select` —
 * браузер показывает пустое поле, и при следующем сохранении проверки оно
 * молча стирается. Потерять так можно возражение, должность или город
 * прошлой проверки, а по ним строится вся отчётность.
 *
 * Тот же разрыв есть и в других разделах портала; правится он там отдельно —
 * здесь чинится только форма проверки.
 */
export function optionsWithCurrent(options: string[], current: string | null | undefined): string[] {
  if (!current || options.includes(current)) return options;
  return [current, ...options];
}

/**
 * Подбор шаблона под проверку: сначала шаблон проекта, при его отсутствии —
 * общий шаблон вида (`project is null`). Правило про удобство ввода, а не
 * про целостность данных, поэтому живёт здесь, а не в базе.
 *
 * Архивные шаблоны отбрасываются явно, хотя `listChecklists` их и так не
 * отдаёт. Это не перестраховка: 19 августа восемь проектных шаблонов
 * заархивировали в пользу одного общего, и просочись такой шаблон в список
 * — он выиграл бы у общего, потому что совпадение по проекту точнее.
 * Проверка заполнялась бы по составу, от которого отказались, и заметить
 * это можно было бы только по числу пунктов.
 */
export function pickChecklist(
  checklists: QualityChecklistRow[],
  kind: QualityKind,
  project: string,
): QualityChecklistRow | null {
  const ofKind = checklists.filter((item) => item.kind === kind && item.archived_at === null);
  return ofKind.find((item) => item.project === project) ?? ofKind.find((item) => item.project === null) ?? null;
}
