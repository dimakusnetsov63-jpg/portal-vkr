import type { BadgeColor } from "@/lib/portal/types";
import type {
  AddressObjectType,
  AddressPaymentType,
  AddressScheduleType,
  AddressShiftType,
  AddressStatus,
} from "@/lib/supabase/addresses.types";

/** Порядок и подписи типов объекта — фиксированный список из ТЗ, хранится в БД как text+CHECK (см. миграцию). */
export const OBJECT_TYPES: readonly AddressObjectType[] = [
  "darkstore",
  "shop",
  "warehouse",
  "pvz",
  "restaurant",
  "production",
  "office",
  "other",
];

export const OBJECT_TYPE_LABELS: Record<AddressObjectType, string> = {
  darkstore: "Даркстор",
  shop: "Магазин",
  warehouse: "Склад",
  pvz: "ПВЗ",
  restaurant: "Ресторан",
  production: "Производство",
  office: "Офис",
  other: "Другое",
};

/** Статусы набора — фиксированные 5 значений из ТЗ, с эмодзи и цветом Badge. */
export const ADDRESS_STATUSES: readonly AddressStatus[] = [
  "stop",
  "reserve",
  "hiring_standby",
  "any_candidate",
  "unrestricted",
];

export const STATUS_LABELS: Record<AddressStatus, string> = {
  stop: "🟥 Стоп (никого)",
  reserve: "🟨 Резерв",
  hiring_standby: "🟦 Найм (на всякий случай)",
  any_candidate: "🟩 Любых берём",
  unrestricted: "🟢 Без ограничений",
};

export const STATUS_COLORS: Record<AddressStatus, BadgeColor> = {
  stop: "red",
  reserve: "amber",
  hiring_standby: "blue",
  any_candidate: "green",
  unrestricted: "teal",
};

/** 5 = критический … 1 = минимальный, отображается звёздами. */
export const PRIORITY_LEVELS = [5, 4, 3, 2, 1] as const;

export const PRIORITY_LABELS: Record<number, string> = {
  5: "★★★★★ Критический",
  4: "★★★★ Высокий",
  3: "★★★ Средний",
  2: "★★ Низкий",
  1: "★ Минимальный",
};

export function priorityStars(priority: number): string {
  return "★".repeat(priority) + "☆".repeat(Math.max(0, 5 - priority));
}

export const SCHEDULE_TYPES: readonly AddressScheduleType[] = ["2/2", "3/3", "5/2", "6/1", "7/0", "flexible", "parttime"];

export const SCHEDULE_TYPE_LABELS: Record<AddressScheduleType, string> = {
  "2/2": "2/2",
  "3/3": "3/3",
  "5/2": "5/2",
  "6/1": "6/1",
  "7/0": "7/0",
  flexible: "Гибкий",
  parttime: "Подработка",
};

export const SHIFT_TYPES: readonly AddressShiftType[] = ["day", "night", "mixed"];

export const SHIFT_TYPE_LABELS: Record<AddressShiftType, string> = {
  day: "День",
  night: "Ночь",
  mixed: "Смешанные",
};

export const PAYMENT_TYPES: readonly AddressPaymentType[] = ["hourly", "per_shift", "per_order"];

export const PAYMENT_TYPE_LABELS: Record<AddressPaymentType, string> = {
  hourly: "Почасовая",
  per_shift: "За смену",
  per_order: "За заказ",
};

/** Слаги чекбоксов "Особенности объекта" — хранятся в addresses.features (text[]), подписи только на клиенте. */
export const FEATURE_OPTIONS: readonly { slug: string; label: string }[] = [
  { slug: "free_meals", label: "Бесплатное питание" },
  { slug: "uniform", label: "Форма" },
  { slug: "training", label: "Обучение" },
  { slug: "locker_room", label: "Раздевалка" },
  { slug: "shower", label: "Душ" },
  { slug: "parking", label: "Парковка" },
  { slug: "medical_book_required", label: "Медкнижка обязательна" },
  { slug: "no_experience_ok", label: "Можно без опыта" },
  { slug: "foreigners_ok", label: "Можно иностранцам" },
  { slug: "weekly_payouts", label: "Еженедельные выплаты" },
  { slug: "accommodation", label: "Проживание" },
  { slug: "commute_compensation", label: "Компенсация проезда" },
  // Заполняется импортом из колонки «Разгрузка» выгрузки «Яндекс Лавки»
  // (см. src/lib/imports/mapping/normalizeConditions.ts); подписи живут
  // здесь, поэтому новый чекбокс не требует миграции.
  { slug: "unloading", label: "Разгрузка" },
];
