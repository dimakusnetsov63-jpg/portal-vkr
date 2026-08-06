import type { AddressScheduleType, AddressShiftType } from "../../supabase/addresses.types";

/**
 * Условия работы на объекте, которые удалось вытащить из выгрузки. Всё
 * опционально: у каждого проекта свой файл, и колонок с условиями может не
 * быть вовсе — тогда поля карточки просто остаются пустыми.
 */
export type ImportedConditions = {
  metro: string | null;
  scheduleType: AddressScheduleType | null;
  shiftType: AddressShiftType | null;
  /** Слаги из FEATURE_OPTIONS (addressOptions.ts), которые файл подтвердил как «да». */
  features: string[];
};

export const EMPTY_CONDITIONS: ImportedConditions = {
  metro: null,
  scheduleType: null,
  shiftType: null,
  features: [],
};

const SCHEDULE_TYPES: readonly AddressScheduleType[] = ["2/2", "3/3", "5/2", "6/1", "7/0", "flexible", "parttime"];

/**
 * Приводит график к одному из значений CHECK-констрейнта
 * `addresses.schedule_type`. В реальной выгрузке «Лавки» один и тот же
 * график записан 29 разными способами: `5/2`, `5\2`, `5-2`, `5|2` — все
 * разделители сводятся к `/`.
 *
 * В ячейке может быть несколько графиков (`«2/2,5/2»`, `«6\1 3\1  2\2»`) —
 * берётся первый распознанный, потому что колонка карточки хранит одно
 * значение. Остальные теряются осознанно: хранить список графиков на
 * объекте — отдельное решение по модели данных, а не задача импорта.
 *
 * Всё, что не попало в разрешённый список (`3/1`, `вахта`, `ежедневно`),
 * даёт `null` — лучше пустое поле, чем выдуманное.
 */
export function normalizeScheduleType(raw: string): AddressScheduleType | null {
  for (const token of raw.split(/[,;\s]+/)) {
    const unified = token.trim().replace(/[\\|­–—-]/g, "/");
    const match = SCHEDULE_TYPES.find((schedule) => schedule === unified);
    if (match) return match;
  }
  return null;
}

/** «Ночной формат работы»: Да → ночная смена, Нет → дневная, пусто → не задано (в файле 2 такие строки). */
export function normalizeShiftType(raw: string): AddressShiftType | null {
  const value = raw.trim().toLowerCase();
  if (value === "да") return "night";
  if (value === "нет") return "day";
  return null;
}

/** Станция метро как есть, только с обрезкой и схлопыванием пробелов: в выгрузке 99 разных значений со свободным регистром («нагорная», «Фили\Шелепиха»), нормализовать их к справочнику нечем — своего списка станций в портале нет. */
export function normalizeMetro(raw: string): string | null {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  return trimmed || null;
}

/** Читает колонку-флаг вида «Да»/«Нет» — используется для «Разгрузки» и подобных чекбоксов. */
export function isYes(raw: string): boolean {
  return raw.trim().toLowerCase() === "да";
}
