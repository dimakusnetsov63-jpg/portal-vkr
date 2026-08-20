import { describe, expect, it } from "vitest";
import {
  activePreset,
  buildReviewFilters,
  defaultFilterState,
  PERIOD_PRESETS,
  startOfMonth,
  todayIso,
  type PeriodPresetId,
  type QualityFilterState,
} from "./qualityFilters";

function preset(id: PeriodPresetId) {
  const found = PERIOD_PRESETS.find((item) => item.id === id);
  if (!found) throw new Error(`нет пресета ${id}`);
  return found;
}

function state(overrides: Partial<QualityFilterState> = {}): QualityFilterState {
  return { ...defaultFilterState(), ...overrides };
}

describe("buildReviewFilters", () => {
  it("пустые поля не уезжают в запрос", () => {
    const filters = buildReviewFilters(state({ project: "", kind: "", search: "" }));

    expect(filters.project).toBeUndefined();
    expect(filters.kind).toBeUndefined();
    expect(filters.search).toBeUndefined();
  });

  it("заполненные поля передаются как есть", () => {
    const filters = buildReviewFilters(state({ project: "Самокат", kind: "refusal" }));

    expect(filters.project).toBe("Самокат");
    expect(filters.kind).toBe("refusal");
  });

  it("поиск обрезается по краям, но пробельный запрос не фильтрует", () => {
    expect(buildReviewFilters(state({ search: "  Иванов  " })).search).toBe("Иванов");
    expect(buildReviewFilters(state({ search: "   " })).search).toBeUndefined();
  });

  it("вкладка «Проверки» не включает ни кейсы, ни архив", () => {
    const filters = buildReviewFilters(state({ tab: "reviews" }));

    expect(filters.onlyCases).toBeUndefined();
    expect(filters.showArchived).toBeUndefined();
  });

  it("вкладка «Аудиотека» показывает только отмеченные кейсы", () => {
    const filters = buildReviewFilters(state({ tab: "cases" }));

    expect(filters.onlyCases).toBe(true);
    expect(filters.showArchived).toBeUndefined();
  });

  it("вкладка «Архив» показывает только убранные из работы", () => {
    const filters = buildReviewFilters(state({ tab: "archived" }));

    expect(filters.showArchived).toBe(true);
    expect(filters.onlyCases).toBeUndefined();
  });

  it("признаки вкладок не включаются одновременно ни при какой вкладке", () => {
    // Оба сразу означали бы «архивные кейсы» — состояние, которого в
    // интерфейсе нет и которое незаметно сузило бы выдачу до пустой.
    for (const tab of ["reviews", "cases", "archived", "checklists"] as const) {
      const filters = buildReviewFilters(state({ tab }));
      expect(Boolean(filters.onlyCases) && Boolean(filters.showArchived)).toBe(false);
    }
  });

  it("вкладка «Шаблоны» не сужает выдачу проверок", () => {
    // Там не проверки, а их критерии. Реестр за этой вкладкой не
    // показывается, но фильтр остаётся прежним: вернувшись на «Проверки»,
    // человек должен увидеть то же, что и уходя.
    const filters = buildReviewFilters(state({ tab: "checklists" }));

    expect(filters.onlyCases).toBeUndefined();
    expect(filters.showArchived).toBeUndefined();
  });

  it("период переносится в запрос", () => {
    const filters = buildReviewFilters(state({ dateFrom: "2026-08-01", dateTo: "2026-08-20" }));

    expect(filters.dateFrom).toBe("2026-08-01");
    expect(filters.dateTo).toBe("2026-08-20");
  });
});

describe("период по умолчанию", () => {
  it("startOfMonth даёт первое число месяца переданной даты", () => {
    expect(startOfMonth(new Date(2026, 7, 20))).toBe("2026-08-01");
  });

  it("todayIso даёт дату без времени", () => {
    // Дата собирается из местных компонентов — тест не должен зависеть от
    // часового пояса, в котором его запускают.
    expect(todayIso(new Date(2026, 7, 20, 15, 42))).toBe("2026-08-20");
  });

  it("BUG-07: местная полночь не съезжает на вчера восточнее Гринвича", () => {
    // new Date(2026, 7, 1).toISOString() в UTC+3 даёт 2026-07-31 — ровно то,
    // из-за чего период по умолчанию начинался на день раньше.
    expect(startOfMonth(new Date(2026, 7, 1, 0, 30))).toBe("2026-08-01");
    expect(todayIso(new Date(2026, 7, 1, 0, 30))).toBe("2026-08-01");
  });

  it("состояние по умолчанию открывает текущий месяц на вкладке проверок", () => {

    const initial = defaultFilterState();

    expect(initial.tab).toBe("reviews");
    expect(initial.dateFrom).toBe(startOfMonth());
    expect(initial.project).toBe("");
  });
});

describe("готовые периоды", () => {
  // Четверг 20 августа 2026. Неделя началась в понедельник 17-го, квартал —
  // 1 июля, прошлый месяц — весь июль.
  const thursday = new Date(2026, 7, 20);

  it("неделя считается от понедельника", () => {
    expect(preset("week").range(thursday)).toEqual({ dateFrom: "2026-08-17", dateTo: "2026-08-20" });
  });

  it("в воскресенье неделя всё ещё начинается с прошедшего понедельника", () => {
    // Самая частая ошибка недельных диапазонов: getDay() в воскресенье
    // возвращает 0, и сдвиг без поправки уводит начало недели на неделю вперёд.
    const sunday = new Date(2026, 7, 23);

    expect(preset("week").range(sunday)).toEqual({ dateFrom: "2026-08-17", dateTo: "2026-08-23" });
  });

  it("в понедельник неделя начинается сегодня", () => {
    const monday = new Date(2026, 7, 17);

    expect(preset("week").range(monday).dateFrom).toBe("2026-08-17");
  });

  it("месяц — с первого числа по сегодня", () => {
    expect(preset("month").range(thursday)).toEqual({ dateFrom: "2026-08-01", dateTo: "2026-08-20" });
  });

  it("прошлый месяц — целиком, включая последнее число", () => {
    expect(preset("prevMonth").range(thursday)).toEqual({ dateFrom: "2026-07-01", dateTo: "2026-07-31" });
  });

  it("прошлый месяц в январе — декабрь прошлого года", () => {
    expect(preset("prevMonth").range(new Date(2026, 0, 15))).toEqual({
      dateFrom: "2025-12-01",
      dateTo: "2025-12-31",
    });
  });

  it("прошлый месяц в марте високосного года кончается 29 февраля", () => {
    // Длина февраля не зашита: нулевой день марта её и даёт.
    expect(preset("prevMonth").range(new Date(2028, 2, 10)).dateTo).toBe("2028-02-29");
  });

  it("квартал начинается с первого месяца своего квартала", () => {
    expect(preset("quarter").range(thursday).dateFrom).toBe("2026-07-01");
    expect(preset("quarter").range(new Date(2026, 0, 5)).dateFrom).toBe("2026-01-01");
    expect(preset("quarter").range(new Date(2026, 11, 31)).dateFrom).toBe("2026-10-01");
  });

  it("год — с первого января по сегодня", () => {
    expect(preset("year").range(thursday)).toEqual({ dateFrom: "2026-01-01", dateTo: "2026-08-20" });
  });

  it("ни один пресет не даёт период задом наперёд", () => {
    for (const item of PERIOD_PRESETS) {
      const range = item.range(thursday);
      expect(range.dateFrom <= range.dateTo).toBe(true);
    }
  });
});

describe("activePreset", () => {
  const thursday = new Date(2026, 7, 20);

  it("узнаёт период, выставленный кнопкой", () => {
    const range = preset("quarter").range(thursday);

    expect(activePreset({ ...defaultFilterState(), ...range }, thursday)).toBe("quarter");
  });

  it("произвольный диапазон не подсвечивает ни одну кнопку", () => {
    const state = { ...defaultFilterState(), dateFrom: "2026-08-03", dateTo: "2026-08-11" };

    expect(activePreset(state, thursday)).toBeNull();
  });

  it("совпадение только по одной границе не считается", () => {
    const state = { ...defaultFilterState(), dateFrom: "2026-08-01", dateTo: "2026-08-19" };

    expect(activePreset(state, thursday)).toBeNull();
  });
});
