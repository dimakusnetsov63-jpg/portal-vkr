import type { BadgeColor } from "@/lib/portal/types";
import type { RateOfficeStatus, RateSchedule, RateUnit } from "@/lib/supabase/rates.types";

/** Единицы измерения тарифа — фиксированный список из ТЗ, хранится в БД как text+CHECK (см. миграцию). */
export const RATE_UNITS: readonly RateUnit[] = [
  "hour",
  "hour_order",
  "hour_item",
  "order",
  "stop",
  "shift",
  "day",
  "route",
];

export const UNIT_LABELS: Record<RateUnit, string> = {
  hour: "За час",
  hour_order: "За час + заказ",
  hour_item: "За час + собранная единица",
  order: "За заказ",
  stop: "За стоп",
  shift: "За смену",
  day: "За сутки",
  route: "За маршрутный лист",
};

/** Показывает ли эта единица измерения поле «за единицу» (rate_piece/pieces_per_shift) в интерфейсе. */
export function unitHasPieceRate(unit: RateUnit): boolean {
  return unit === "hour_order" || unit === "hour_item" || unit === "order" || unit === "stop";
}

/** График — тот же набор значений, что addresses.schedule_type (одна и та же бизнес-сущность «график работы»), но отдельный тип: rates.schedule и addresses.schedule_type не связаны FK и могут разойтись независимо. */
export const RATE_SCHEDULES: readonly RateSchedule[] = ["2/2", "3/3", "5/2", "6/1", "7/0", "flexible", "parttime"];

export const SCHEDULE_LABELS: Record<RateSchedule, string> = {
  "2/2": "2/2",
  "3/3": "3/3",
  "5/2": "5/2",
  "6/1": "6/1",
  "7/0": "7/0",
  flexible: "Гибкий",
  parttime: "Подработка",
};

export const OFFICE_STATUSES: readonly RateOfficeStatus[] = ["working", "not_working", "unknown"];

export const OFFICE_STATUS_LABELS: Record<RateOfficeStatus, string> = {
  working: "Работает",
  not_working: "Не работает",
  unknown: "Не указано",
};

export const OFFICE_STATUS_COLORS: Record<RateOfficeStatus, BadgeColor> = {
  working: "green",
  not_working: "red",
  unknown: "gray",
};

/** Слаги зарплатных банков — хранятся в rate_cards.payroll_banks (text[]), подписи только на клиенте. */
export const PAYROLL_BANK_OPTIONS: readonly { slug: string; label: string }[] = [
  { slug: "vtb", label: "ВТБ" },
  { slug: "gpb", label: "ГПБ" },
  { slug: "tbank", label: "Т-Банк" },
  { slug: "sber", label: "Сбербанк" },
  { slug: "alfa", label: "Альфа-Банк" },
];

export function payrollBankLabel(slug: string): string {
  return PAYROLL_BANK_OPTIONS.find((b) => b.slug === slug)?.label ?? slug;
}
