/**
 * Разбор рабочего файла «Самоотказы КЦ» и импорт проверок самоотказов.
 *
 * Второй скрипт, а не флаг у первого: файлы устроены по-разному настолько,
 * что общего в них остаётся только чтение ячеек — оно и вынесено в
 * `quality-excel.mjs`. У звонков лист на проект и 68 колонок, здесь лист на
 * месяц и 22, проект лежит в самой строке, а шаблон один общий на все
 * проекты.
 *
 * ОСОБЕННОСТЬ ЭТОГО ФАЙЛА. Баллы лежат в колонках **без заголовка**
 * («Столбец 1», «Столбец 3», …), а осмысленное название несёт соседняя
 * колонка с процентом — «% Возражение отработано». Поэтому балльная колонка
 * ищется как «та, что слева от процентной», а не по своему имени. У листа
 * «База Май» раскладка своя (лишняя колонка «Стадия» сдвигает всё вправо), и
 * именно поэтому колонки ищутся по заголовкам, а не по номерам.
 *
 * Запуск:
 *   node scripts/import-quality-refusals.mjs                 # отчёт
 *   node scripts/import-quality-refusals.mjs --sql > out.sql # + SQL
 */

import ExcelJS from "exceljs";
import fs from "node:fs";
import { boolFrom, leadId, norm, payloadLiteral, projectOf, score, text, toIsoDate } from "./quality-excel.mjs";

const FILE = process.env.REFUSALS_XLSX ?? "C:/Users/Redmi/Downloads/Самоотказы КЦ  (1).xlsx";
const TREE = JSON.parse(fs.readFileSync(process.env.REFUSAL_TREE ?? "refusal-tree.json", "utf8"));
const EMIT_SQL = process.argv.includes("--sql");
const ACTOR = process.env.QUALITY_ACTOR ?? "ed48370f-a0a0-491f-aafa-7994ae561de0";
const BATCH = process.env.QUALITY_BATCH ?? crypto.randomUUID();

const SHEETS = ["База Май", "База Июнь", "База Июль", "База Август"];

/**
 * Процентная колонка → пункт шаблона. Балл берётся из колонки слева.
 * «Инф-сть» в файле — сокращение от «Информативность»; сокращения
 * сопоставляются здесь явно, а не угадываются похожестью.
 */
const PERCENT_TO_ITEM = {
  "% возражение отработано": "Возражение отработано",
  "% возражение отработано качественно": "Возражение отработано качественно",
  "% инф-сть комментария": "Информативность комментария",
  "% причина соответствует": "Причина соответствует",
};

/**
 * Проверяющий в этом файле не записан вовсе — колонки под него нет.
 * Функция сохранения подставила бы логин того, кто запускает импорт, но это
 * неправда: он этих проверок не делал. Честнее сказать, что неизвестно.
 */
const REVIEWER_UNKNOWN = "Не указан";

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(FILE);

const itemByTitle = new Map(TREE.items.map((i) => [norm(i.item), i]));

const all = [];
const problems = { noProject: new Map(), noLead: 0, noDate: 0, unknownCell: 0 };

for (const sheetName of SHEETS) {
  const ws = wb.getWorksheet(sheetName);
  if (!ws) continue;

  const col = {};
  ws.getRow(1).eachCell({ includeEmpty: false }, (cell, c) => {
    const title = text(cell.value).replace(/\s+/g, " ").trim();
    if (title && col[title] === undefined) col[title] = c;
  });
  if (!col["Ссылка на лид"]) continue;

  // Балльные колонки: слева от процентной.
  const scoreColumns = [];
  for (const [title, c] of Object.entries(col)) {
    const item = itemByTitle.get(norm(PERCENT_TO_ITEM[norm(title)] ?? ""));
    if (item) scoreColumns.push({ column: c - 1, item, from: title });
  }

  const rows = [];
  for (let r = 2; r <= ws.rowCount; r += 1) {
    const line = ws.getRow(r);
    const lead = leadId(line.getCell(col["Ссылка на лид"]));
    if (lead === null) continue;

    const scores = [];
    let unknown = 0;
    for (const sc of scoreColumns) {
      const s = score(line.getCell(sc.column).value, sc.item.scale);
      if (s.kind === "value") scores.push({ item_id: sc.item.item_id, value: s.value, is_na: false });
      else if (s.kind === "na") scores.push({ item_id: sc.item.item_id, value: null, is_na: true });
      else if (s.kind === "unknown") unknown += 1;
    }
    // В листе июня 2765 лидов, а проверены 204: строка без единой оценки —
    // это лид, до которого не дошли, а не проверка. Такие не переносим.
    if (scores.length === 0) continue;
    problems.unknownCell += unknown;

    const rawProject = text(line.getCell(col["Проект"]).value).trim();
    const project = projectOf(rawProject);
    if (!project) {
      problems.noProject.set(rawProject || "<пусто>", (problems.noProject.get(rawProject || "<пусто>") ?? 0) + 1);
      continue;
    }

    const reviewDate = toIsoDate(line.getCell(col["Дата проверки"]).value);
    if (!reviewDate) {
      problems.noDate += 1;
      continue;
    }

    const pick = (title) => (col[title] ? line.getCell(col[title]).value : null);
    const targetRaw = norm(pick("Целевой"));
    const outbound = Number(text(pick("Счетчик исходящих звонков")).replace(",", "."));

    rows.push({
      sheet: sheetName,
      row: r,
      crm_lead_id: lead,
      project,
      employee_name: text(pick("Рекрутер")).trim() || "Не указан",
      reviewer_name: REVIEWER_UNKNOWN,
      review_date: reviewDate,
      call_date: toIsoDate(pick("Дата звонка")),
      position: text(pick("Должность")).trim() || null,
      city: text(pick("Город")).trim() || null,
      objection: text(pick("Возражение кандидата")).trim() || null,
      crm_comment: text(pick("Комментарий")).trim() || null,
      handling_speed: text(pick("Скорость обработки")).trim() || null,
      outbound_calls: Number.isFinite(outbound) ? outbound : null,
      is_target: targetRaw === "" ? null : boolFrom(targetRaw),
      is_case: boolFrom(pick("Кейс в аудиотеку")),
      case_comment: text(pick("Комментарий по кейсу (почему именно этот кейс)")).trim() || null,
      complete: scores.length === TREE.items.length,
      scores,
    });
  }

  const full = rows.filter((r) => r.complete).length;
  console.error(`«${sheetName}»: проверок ${rows.length}, заполнены целиком ${full}, колонок с баллами ${scoreColumns.length} из ${TREE.items.length}`);
  all.push(...rows);
}

console.error(`\nИТОГО: ${all.length} проверок, завершённых ${all.filter((r) => r.complete).length}`);
if (problems.noProject.size) {
  console.error("Проект не сопоставлен со справочником:");
  for (const [p, n] of problems.noProject) console.error(`   «${p}» × ${n}`);
}
if (problems.noDate) console.error(`Без даты проверки: ${problems.noDate}`);
if (problems.unknownCell) console.error(`Ячеек с непонятным значением: ${problems.unknownCell}`);

const byProject = new Map();
for (const r of all) byProject.set(r.project, (byProject.get(r.project) ?? 0) + 1);
console.error("\nПо проектам:");
for (const [p, n] of [...byProject].sort((a, b) => b[1] - a[1])) console.error(`   ${p}: ${n}`);

if (!EMIT_SQL) process.exit(0);

const lines = [
  "-- Импорт истории проверок самоотказов из «Самоотказы КЦ».",
  `-- Пакет ${BATCH} — откат: delete from public.quality_reviews where import_id = '${BATCH}';`,
  "",
  `select set_config('request.jwt.claims', json_build_object('sub', '${ACTOR}')::text, true);`,
  "create temp table imported_refusals (id uuid) on commit drop;",
  "",
];

for (const r of all) {
  const payload = {
    checklist_id: TREE.checklist_id,
    crm_lead_id: r.crm_lead_id,
    project: r.project,
    employee_name: r.employee_name,
    reviewer_name: r.reviewer_name,
    review_date: r.review_date,
    call_date: r.call_date,
    position: r.position,
    city: r.city,
    objection: r.objection,
    crm_comment: r.crm_comment,
    handling_speed: r.handling_speed,
    outbound_calls: r.outbound_calls,
    is_target: r.is_target,
    is_case: r.is_case,
    case_comment: r.case_comment,
    status: r.complete ? "completed" : "draft",
    scores: r.scores,
  };
  lines.push(
    `insert into imported_refusals select (public.portal_save_quality_review(null, ${payloadLiteral(payload)}::jsonb) ->> 'id')::uuid;`,
  );
}

lines.push("");
lines.push(`update public.quality_reviews set import_id = '${BATCH}'::uuid where id in (select id from imported_refusals);`);
lines.push("");

process.stdout.write(lines.join("\n"));
console.error(`\nSQL: ${all.length} проверок. Пакет ${BATCH}`);
