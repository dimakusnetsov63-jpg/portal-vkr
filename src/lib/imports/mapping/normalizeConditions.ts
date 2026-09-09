import type { AddressScheduleType, AddressShiftType } from "../../supabase/addresses.types";

/**
 * Условия работы на объекте, которые удалось вытащить из выгрузки. Всё
 * опционально: у каждого проекта свой файл, и колонок с условиями может не
 * быть вовсе — тогда поля карточки просто остаются пустыми.
 */
export type ImportedConditions = {
  metro: string | null;
  /** Первый распознанный график — для ручного поля карточки `schedule_type`, которое импорт заполняет только пустым (см. addressPlan.conditionsPatchFor). */
  scheduleType: AddressScheduleType | null;
  /** Все распознанные графики этой строки — складываются по объекту в `addresses.schedule_types`. */
  scheduleTypes: AddressScheduleType[];
  shiftType: AddressShiftType | null;
  /** Слаги из FEATURE_OPTIONS (addressOptions.ts), которые файл подтвердил как «да». */
  features: string[];
};

export const EMPTY_CONDITIONS: ImportedConditions = {
  metro: null,
  scheduleType: null,
  scheduleTypes: [],
  shiftType: null,
  features: [],
};

const SCHEDULE_TYPES: readonly AddressScheduleType[] = ["2/2", "3/3", "5/2", "6/1", "7/0", "flexible", "parttime"];

/**
 * Все графики ячейки, приведённые к значениям CHECK-констрейнта
 * `addresses.schedule_types`. В реальной выгрузке «Лавки» один и тот же
 * график записан 29 разными способами: `5/2`, `5\2`, `5-2`, `5|2` — все
 * разделители сводятся к `/`.
 *
 * В одной ячейке может быть несколько графиков (`«2/2,5/2»`,
 * `«6\1 3\1  2\2»`, `«5/2-6/1»`) — возвращаются все распознанные, без
 * повторов, в порядке появления. Всё, что не попало в разрешённый список
 * (`3/1`, `вахта`, `ежедневно`), пропускается — лучше короче, чем
 * выдуманное.
 *
 * Дефис двусмыслен и поэтому разбирается в два захода: в `«5-2»` он
 * разделяет части одного графика, а в `«5/2-6/1»` — два разных графика.
 * Сначала пробуем токен целиком (`5-2` → `5/2`), и только если он не
 * опознался — делим по дефису и пробуем части (`5/2-6/1` → `5/2` + `6/1`).
 * Без второго захода такая ячейка не давала вообще ничего, а в выгрузке от
 * 27.08.2026 она встречается.
 */
export function normalizeScheduleTypes(raw: string): AddressScheduleType[] {
  const found: AddressScheduleType[] = [];
  const add = (candidate: string): boolean => {
    const match = SCHEDULE_TYPES.find((schedule) => schedule === unifySeparators(candidate));
    if (!match) return false;
    if (!found.includes(match)) found.push(match);
    return true;
  };

  for (const token of raw.split(/[,;\s]+/)) {
    if (add(token)) continue;
    if (token.includes("-")) for (const part of token.split("-")) add(part);
  }
  return found;
}

function unifySeparators(token: string): string {
  return token.trim().replace(/[\\|­–—-]/g, "/");
}

/**
 * Первый распознанный график ячейки — для одиночного поля карточки
 * `schedule_type`, которое ведёт координатор и импорт заполняет только
 * пустым. Полный список идёт отдельно, в `schedule_types`
 * (`normalizeScheduleTypes`).
 */
export function normalizeScheduleType(raw: string): AddressScheduleType | null {
  return normalizeScheduleTypes(raw)[0] ?? null;
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
