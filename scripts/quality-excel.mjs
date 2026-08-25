/**
 * Общее для разбора рабочих файлов контроля качества.
 *
 * Два файла — «Чек-листы по проектам» (звонки) и «Самоотказы КЦ» — устроены
 * по-разному: у первого лист на проект и по 68 колонок, у второго лист на
 * месяц и 22. Но читаются они одинаково: те же ячейки-объекты exceljs, те же
 * даты, те же гиперссылки на лид, тот же разнобой в тире и пробелах. Эти
 * куски живут здесь, чтобы правка нашлась в одном месте, а не в двух.
 */

/** Ячейка exceljs бывает строкой, числом, датой, формулой, ссылкой и rich text. */
export function text(v) {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if (v.richText) return v.richText.map((p) => p.text).join("");
    if (v.text !== undefined) return String(v.text);
    if (v.result !== undefined) return String(v.result);
    if (v.hyperlink) return String(v.hyperlink);
  }
  return String(v);
}

/**
 * Приводит формулировку к виду, по которому её сравнивают.
 *
 * Сглаживаются только механические различия набора, не смысловые: двойные
 * пробелы и переносы строк, разные виды тире и кавычек, точка в конце. Всё
 * это встречается в файлах и в шаблонах вперемешку — «при тяжких –
 * завершение» против «при тяжких — завершение». Без сглаживания такие пары
 * не находят друг друга, и пункт молча теряет оценку.
 *
 * Ничего сверх этого приводить нельзя: два пункта, различающиеся словами,
 * обязаны остаться разными.
 */
export function norm(s) {
  return text(s)
    .replace(/[‐-―−]/g, "-")
    .replace(/[«»“”„‘’]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.;,]+$/, "")
    .toLowerCase();
}

export function toIsoDate(v) {
  if (v instanceof Date) {
    // Дата из Excel приходит в UTC; берём её календарные части, иначе
    // проверка съедет на день назад.
    return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, "0")}-${String(v.getUTCDate()).padStart(2, "0")}`;
  }
  const s = text(v).trim();
  const m = s.match(/^(\d{2})[.\/](\d{2})[.\/](\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

/** Номер лида: в файлах это гиперссылка на карточку CRM либо голое число. */
export function leadId(cell) {
  const raw = cell?.value;
  const candidates = [];
  if (raw && typeof raw === "object") {
    if (raw.hyperlink) candidates.push(String(raw.hyperlink));
    if (raw.text) candidates.push(String(raw.text));
  }
  candidates.push(text(raw));
  if (cell?.hyperlink) candidates.push(String(cell.hyperlink));

  for (const c of candidates) {
    const m = c.match(/(\d{4,})/);
    if (m) return Number(m[1]);
  }
  return null;
}

export const CALL_TYPES = { исходящий: "outgoing", входящий: "incoming", недозвон: "no_answer" };

/**
 * Балл из ячейки: 0/1/2, «н/д» или пусто.
 *
 * У переключателя блока («Было возражение?») в файле стоит «Да»/«Нет», а не
 * балл — в портале это 1 и 0. На части листов там же встречается 0/2:
 * колонка заведена той же формулой, что соседние. Любое положительное
 * значение означает «да».
 */
export function score(v, scale) {
  const s = norm(v);
  if (s === "") return { kind: "empty" };
  if (s === "н/д" || s === "нд" || s === "n/a") return { kind: "na" };

  if (scale === "yes_no") {
    if (s === "да") return { kind: "value", value: 1 };
    if (s === "нет") return { kind: "value", value: 0 };
    const yn = Number(s.replace(",", "."));
    if (Number.isFinite(yn)) return { kind: "value", value: yn > 0 ? 1 : 0 };
    return { kind: "unknown", raw: text(v) };
  }

  const n = Number(s.replace(",", "."));
  if (Number.isFinite(n) && [0, 1, 2].includes(n)) return { kind: "value", value: n };
  return { kind: "unknown", raw: text(v) };
}

export function boolFrom(v) {
  const s = norm(v);
  return s === "true" || s === "да" || s === "1" || s === "+";
}

/**
 * Лист файла → проект портала. Названия в рабочих таблицах свои, и подбор
 * идёт точным совпадением строки: шаблон с названием мимо справочника не
 * найдётся никогда — на этом раздел уже обжигался 19 августа.
 *
 * «Криспи» оказался существующим клиентом «ДонатсКофе» — вопрос висел
 * открытым с миграции 20260819100100, закрыт бизнесом 21 августа.
 */
export const PROJECT_ALIASES = {
  "бургер кинг": "Бургер кинг Россия",
  газпром: "Газпромнефть",
  "самокат вахта": "Самокат Вахта",
  "самокат местные": "Самокат",
  "самокат местный": "Самокат",
  "яндекс лавка": "Яндекс Лавка",
  криспи: "ДонатсКофе",
  "донатс кофе": "ДонатсКофе",
  мд: "Мастер Деливери",
  купер: "Купер",
};

export function projectOf(raw) {
  return PROJECT_ALIASES[norm(raw)] ?? null;
}

/** Экранирование для dollar-quoted строки SQL. */
export function payloadLiteral(payload) {
  return `$vkr$${JSON.stringify(payload)}$vkr$`;
}
