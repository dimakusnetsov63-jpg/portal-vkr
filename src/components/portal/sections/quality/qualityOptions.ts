import type { QualityCallType, QualityItemScale, QualityKind } from "@/lib/supabase/quality.types";

/** Подписи и мелкие форматтеры раздела «Контроль качества». */

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
