import type { IconName } from "@/components/portal/ui/Icon";
import type { VacancyFieldType } from "@/lib/supabase/vacancyProjects.types";

/**
 * Поля-затравки системного раздела «Общая информация», создаются один раз
 * `vacancyProjectsRepo.createVacancyProject` — дальше это обычные
 * `vacancy_fields`, редактируются/удаляются/переименовываются как любые
 * другие. Не CHECK-ограничение и не персистентный шаблон в БД.
 */
export const VACANCY_GENERAL_SECTION_SEED: readonly { label: string; field_type: VacancyFieldType }[] = [
  { label: "Профиль", field_type: "text" },
  { label: "Должность в Битрикс", field_type: "text" },
  { label: "Регион работы", field_type: "text" },
  { label: "Период работы", field_type: "text" },
  { label: "Подробное описание", field_type: "link" },
  { label: "Дополнительное описание", field_type: "rich_text" },
];

/**
 * Подсказки для «+ Добавить раздел» — типичные названия разделов вакансии
 * (по разбору «Описание вакансий.xlsx»), не список допустимых значений:
 * пользователь может ввести любое своё название вместо любой из этих
 * подсказок.
 */
export const VACANCY_SECTION_SUGGESTIONS: readonly { title: string; icon: IconName }[] = [
  { title: "График работы", icon: "clock" },
  { title: "Обязанности", icon: "target" },
  { title: "Требования", icon: "shield" },
  { title: "Доход и выплаты", icon: "cash" },
  { title: "Акции и бонусы", icon: "gift" },
  { title: "Условия работы", icon: "box" },
  { title: "Оформление", icon: "file" },
  { title: "Этапы трудоустройства", icon: "graduation" },
  { title: "Дополнительная информация", icon: "info" },
];

const KEYWORD_ICONS: readonly [RegExp, IconName][] = [
  [/оформ/i, "file"],
  [/график|время работ|рабочее мест/i, "clock"],
  [/период работ|дата начала/i, "calendar"],
  [/оплат|выплат|ставк|зарплат|доход/i, "cash"],
  [/интервью|собеседован|трудоустройств|стажир|обучен/i, "graduation"],
  [/треб|возраст|гражданств|документ/i, "shield"],
  [/мед/i, "heart"],
  [/обязан/i, "target"],
  [/профиль/i, "users"],
  [/акци|бонус|преимущ/i, "gift"],
  [/регион|адрес|гео/i, "mapPin"],
  [/инвентар|вложени/i, "box"],
];

/** Подсказка иконки по названию раздела при создании — чисто косметический дефолт, ничего не ограничивает (аналог iconForLabel из старого VacanciesSection.tsx, под свободную структуру разделов). */
export function guessSectionIcon(title: string): IconName {
  for (const [pattern, icon] of KEYWORD_ICONS) {
    if (pattern.test(title)) return icon;
  }
  return "info";
}
