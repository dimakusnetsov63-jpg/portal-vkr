/**
 * Разбор рабочего файла «Чек-листы по проектам» и подготовка импорта
 * проверок звонков в раздел «Контроль качества».
 *
 * ЗАЧЕМ ОТДЕЛЬНЫМ СКРИПТОМ, А НЕ КНОПКОЙ В ПОРТАЛЕ. Это разовый переезд
 * истории, а не постоянный обмен: после него команда работает в портале.
 * Постоянный импортёр пришлось бы делать устойчивым к произвольным файлам,
 * а здесь файл известен и разбирается один раз — но разбирается сложно, с
 * ручным сопоставлением колонок и справочников. Тот же довод, что у
 * `import-vacancy-data.mjs`.
 *
 * ЧТО ДЕЛАЕТ. Читает лист каждого проекта, сопоставляет колонки с пунктами
 * шаблона **по тексту**, значения справочников (проект, сотрудник) — с
 * общими списками портала, и печатает отчёт. По умолчанию — вхолостую:
 * ничего не пишет и ничего не меняет. С `--sql` печатает SQL импорта.
 *
 * ПОЧЕМУ ИМПОРТ ИДЁТ ЧЕРЕЗ RPC, А НЕ ПРЯМЫМ INSERT. Проценты по блокам и
 * итог считает `portal_save_quality_review`; прямой INSERT потребовал бы
 * третьей копии формулы (после SQL и TypeScript), и она разошлась бы первой
 * же правкой. Скрипт выставляет claim `request.jwt.claims` в транзакции,
 * поэтому функция видит настоящего пользователя и применяет обычные
 * проверки прав, проекта и полноты заполнения.
 *
 * Запуск:
 *   node scripts/import-quality-history.mjs                 # отчёт
 *   node scripts/import-quality-history.mjs --sql > out.sql # + SQL
 */

import ExcelJS from "exceljs";
import fs from "node:fs";
import path from "node:path";
import { CALL_TYPES, leadId, norm, payloadLiteral, score, text, toIsoDate } from "./quality-excel.mjs";

const FILE = process.env.QUALITY_XLSX ?? "C:/Users/Redmi/Downloads/Чек-листы по проектам (1).xlsx";
const TREES = process.env.QUALITY_TREES ?? "trees.clean.json";
const EMIT_SQL = process.argv.includes("--sql");

/**
 * Лист файла → проект портала. Сопоставление согласовано с бизнесом:
 * «Криспи» оказался существующим клиентом «ДонатсКофе» (вопрос висел
 * открытым с миграции 20260819100100), «Самокат» разделён на местный и
 * вахтовый — это два разных проекта справочника.
 */
const SHEET_TO_PROJECT = {
  "Бургер Кинг": "Бургер кинг Россия",
  Газпром: "Газпромнефть",
  "Самокат вахта": "Самокат Вахта",
  "Яндекс Лавка": "Яндекс Лавка",
  "Донатс Кофе": "ДонатсКофе",
  Купер: "Купер",
  "Самокат местный": "Самокат",
  МД: "Мастер Деливери",
};

/** Колонки шапки проверки — всё, что до первого пункта чек-листа. */
const HEAD_COLUMNS = {
  "Дата оценки": "reviewDate",
  Проверяющий: "reviewerName",
  "Ссылка на лид": "lead",
  Сотрудник: "employeeName",
  "Дата звонка": "callDate",
  "Тип звонка": "callType",
};

/**
 * Колонки хвоста, которые всё-таки переносятся: это поля проверки, а не
 * пункты чек-листа. Ищутся по заголовку, а не по номеру — раскладка у
 * каждого листа своя.
 */
const SPECIAL_COLUMNS = {
  Нарушение: "violation",
  "Рекомендации и комментарии": "recommendations",
  Кейс: "isCase",
};

/** Колонки-хвост: считаются самим порталом либо не относятся к пунктам. */
const TAIL_PATTERNS = [/^общий процент/i, /^нарушение/i, /^рекомендации/i, /^кейс/i, /^месяц/i, /^%/];

// --- Разбор листа --------------------------------------------------------

/**
 * Ищет строку с названиями колонок. У большинства листов это строка 2, у
 * «Самоката местного» — третья: там первая строка занята заголовком скрипта.
 * Искать по содержимому надёжнее, чем помнить исключения.
 */
function findHeaderRow(ws) {
  for (let r = 1; r <= Math.min(6, ws.rowCount); r += 1) {
    if (norm(ws.getRow(r).getCell(1).value) === "дата оценки") return r;
  }
  return null;
}

function isTail(title) {
  return TAIL_PATTERNS.some((re) => re.test(title.trim()));
}

function parseSheet(ws, tree) {
  const headerRow = findHeaderRow(ws);
  if (!headerRow) return { error: "не найдена строка заголовков (нет «Дата оценки» в первой колонке)" };

  const byTitle = new Map();
  for (const item of tree.items) {
    const key = norm(item.item);
    if (!byTitle.has(key)) byTitle.set(key, item);
  }

  const head = {};
  const extra = {};
  const itemColumns = [];
  const unmatched = [];
  const usedItems = new Set();

  const row = ws.getRow(headerRow);
  for (let c = 1; c <= ws.columnCount; c += 1) {
    const raw = text(row.getCell(c).value).replace(/\s+/g, " ").trim();
    if (!raw) continue;

    const headKey = HEAD_COLUMNS[raw];
    if (headKey) {
      // Первое вхождение: «Сотрудник» и «Проект» повторяются в хвосте
      // листа как формулы для сводных, и второе перетёрло бы настоящее.
      if (head[headKey] === undefined) head[headKey] = c;
      continue;
    }

    const special = SPECIAL_COLUMNS[raw] ?? (/^общий процент/i.test(raw) ? "excelPercent" : null);
    if (special) {
      if (extra[special] === undefined) extra[special] = c;
      continue;
    }
    if (isTail(raw)) continue;

    const item = byTitle.get(norm(raw));
    if (item && !usedItems.has(item.item_id)) {
      usedItems.add(item.item_id);
      itemColumns.push({ column: c, item, title: raw });
    } else if (item) {
      unmatched.push({ column: c, title: raw, why: "пункт уже занят другой колонкой" });
    } else {
      unmatched.push({ column: c, title: raw, why: "нет такого пункта в шаблоне" });
    }
  }

  const missingItems = tree.items.filter((i) => !usedItems.has(i.item_id));

  const reviews = [];
  for (let r = headerRow + 1; r <= ws.rowCount; r += 1) {
    const line = ws.getRow(r);
    const reviewer = text(line.getCell(head.reviewerName ?? 2).value).trim();
    const employee = text(line.getCell(head.employeeName ?? 4).value).trim();
    if (!reviewer || !employee) continue;

    const scores = [];
    const answeredIds = new Set();
    const badCells = [];
    for (const col of itemColumns) {
      const s = score(line.getCell(col.column).value, col.item.scale);
      if (s.kind === "value") {
        scores.push({ item_id: col.item.item_id, value: s.value, is_na: false });
        answeredIds.add(col.item.item_id);
      } else if (s.kind === "na") {
        scores.push({ item_id: col.item.item_id, value: null, is_na: true });
        answeredIds.add(col.item.item_id);
      } else if (s.kind === "unknown") {
        badCells.push({ column: col.column, raw: s.raw });
      }
    }

    /*
     * Полнота считается по правилам портала, а не «все ячейки заполнены».
     * Блок с переключателем, ответившим «Нет», не заполняется вовсе — и в
     * файле он законно пуст. Считать такую строку неполной значило бы
     * отправить её в черновики, а черновик не попадает ни в один отчёт:
     * история переехала бы, но осталась невидимой.
     */
    const closedGroups = new Set(
      tree.items
        .filter((i) => i.scale === "yes_no")
        .filter((i) => scores.some((s) => s.item_id === i.item_id && s.value === 0 && !s.is_na))
        .map((i) => i.group),
    );
    const required = tree.items.filter((i) => !closedGroups.has(i.group) || i.scale === "yes_no");
    const missing = required.filter((i) => !answeredIds.has(i.item_id));
    const answered = answeredIds.size;

    const cell = (key) => (extra[key] ? line.getCell(extra[key]).value : null);
    const caseRaw = norm(cell("isCase"));

    reviews.push({
      row: r,
      violation: text(cell("violation")).trim() || null,
      recommendations: text(cell("recommendations")).trim() || null,
      isCase: caseRaw === "true" || caseRaw === "да" || caseRaw === "1",
      excelPercent: extra.excelPercent ? text(line.getCell(extra.excelPercent).value).trim() : null,
      crm_lead_id: leadId(line.getCell(head.lead ?? 3)),
      reviewer_name: reviewer,
      employee_name: employee,
      review_date: toIsoDate(line.getCell(head.reviewDate ?? 1).value),
      call_date: toIsoDate(line.getCell(head.callDate ?? 5).value),
      call_type: CALL_TYPES[norm(line.getCell(head.callType ?? 6).value)] ?? null,
      scores,
      answered,
      missing: missing.length,
      complete: missing.length === 0,
      total: itemColumns.length,
      badCells,
    });
  }

  return { headerRow, itemColumns, unmatched, missingItems, reviews, extra };
}

// --- Отчёт ---------------------------------------------------------------

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(FILE);

const treesRaw = JSON.parse(fs.readFileSync(path.resolve(TREES), "utf8"));
const treeByProject = new Map(treesRaw.map((t) => [t.project, t]));

const out = [];
let grandRows = 0;
let grandFull = 0;

console.error(`Файл: ${FILE}\n`);

for (const [sheetName, project] of Object.entries(SHEET_TO_PROJECT)) {
  const ws = wb.getWorksheet(sheetName);
  if (!ws) {
    console.error(`— «${sheetName}»: листа нет в файле`);
    continue;
  }
  const tree = treeByProject.get(project);
  if (!tree) {
    console.error(`— «${sheetName}» → «${project}»: НЕТ ДЕЙСТВУЮЩЕГО ШАБЛОНА, лист пропущен`);
    continue;
  }

  const parsed = parseSheet(ws, tree);
  if (parsed.error) {
    console.error(`— «${sheetName}»: ${parsed.error}`);
    continue;
  }

  const full = parsed.reviews.filter((r) => r.complete).length;
  const noLead = parsed.reviews.filter((r) => r.crm_lead_id === null).length;
  const noDate = parsed.reviews.filter((r) => !r.review_date).length;
  const bad = parsed.reviews.reduce((s, r) => s + r.badCells.length, 0);

  grandRows += parsed.reviews.length;
  grandFull += full;

  console.error(`«${sheetName}» → ${project}  (${tree.checklist_title})`);
  console.error(`   строк: ${parsed.reviews.length}, заполнены целиком: ${full}, черновиками уйдёт: ${parsed.reviews.length - full}`);
  console.error(`   колонок сошлось с пунктами: ${parsed.itemColumns.length} из ${tree.items.length}`);
  if (parsed.missingItems.length) {
    console.error(`   пунктов шаблона без колонки: ${parsed.missingItems.length} — ${parsed.missingItems.map((i) => i.item).slice(0, 4).join(" / ")}${parsed.missingItems.length > 4 ? " …" : ""}`);
  }
  if (parsed.unmatched.length) {
    console.error(`   колонок без пункта: ${parsed.unmatched.length}`);
    for (const u of parsed.unmatched.slice(0, 6)) console.error(`      кол.${u.column}: «${u.title}» — ${u.why}`);
    if (parsed.unmatched.length > 6) console.error(`      … и ещё ${parsed.unmatched.length - 6}`);
  }
  if (noLead) console.error(`   без номера лида: ${noLead}`);
  if (noDate) console.error(`   без даты проверки: ${noDate}`);
  if (bad) console.error(`   ячеек с непонятным значением: ${bad}`);
  console.error("");

  out.push({ sheetName, project, tree, parsed });
}

console.error(`ИТОГО: строк ${grandRows}, из них заполнены целиком ${grandFull}`);

if (!EMIT_SQL) process.exit(0);

// --- SQL импорта ---------------------------------------------------------

/**
 * Импорт идёт вызовами `portal_save_quality_review` — той же функции, что
 * работает при ручном вводе. Значит, проценты считает она, а не третья копия
 * формулы, и применяются обычные проверки: право на раздел, доступ к
 * проекту, вид проверки из шаблона, полнота заполнения.
 *
 * Функция узнаёт пользователя из claim'а JWT, поэтому claim выставляется в
 * самой транзакции. Права при этом настоящие: под руководителем, как если бы
 * он вводил эти проверки руками.
 *
 * Весь импорт — одна транзакция: файл `supabase db query` выполняется
 * целиком либо не выполняется вовсе. Половина перенесённой истории хуже, чем
 * не перенесённая.
 */
const ACTOR = process.env.QUALITY_ACTOR ?? "ed48370f-a0a0-491f-aafa-7994ae561de0";
const BATCH = process.env.QUALITY_BATCH ?? crypto.randomUUID();

const lines = [];
lines.push(`-- Импорт истории проверок звонков из «Чек-листы по проектам».`);
lines.push(`-- Пакет ${BATCH} — откат: delete from public.quality_reviews where import_id = '${BATCH}';`);
lines.push("");
lines.push(`select set_config('request.jwt.claims', json_build_object('sub', '${ACTOR}')::text, true);`);
lines.push("create temp table imported_reviews (id uuid) on commit drop;");
lines.push("");

let emitted = 0;
let skipped = 0;

for (const { sheetName, project, tree, parsed } of out) {
  lines.push(`-- ${sheetName} → ${project}`);
  for (const r of parsed.reviews) {
    // Номер лида, дата проверки и проверяющий — обязательные поля строки.
    // Без них проверка не строка истории, а обрывок; такие пропускаются с
    // явным упоминанием в отчёте, а не подставляются заглушками.
    if (r.crm_lead_id === null || !r.review_date || !r.reviewer_name) {
      skipped += 1;
      console.error(`   пропуск: ${sheetName} строка ${r.row} — нет ${[r.crm_lead_id === null && "лида", !r.review_date && "даты", !r.reviewer_name && "проверяющего"].filter(Boolean).join(", ")}`);
      continue;
    }

    const payload = {
      checklist_id: tree.checklist_id,
      crm_lead_id: r.crm_lead_id,
      project,
      employee_name: r.employee_name,
      reviewer_name: r.reviewer_name,
      review_date: r.review_date,
      call_date: r.call_date,
      call_type: r.call_type,
      violation: r.violation ?? null,
      recommendations: r.recommendations ?? null,
      is_case: r.isCase === true,
      // Незавершённые остаются черновиками честно: портал не даёт закрыть
      // проверку с пропусками, и обходить это правило ради красивой цифры
      // значило бы сломать то, ради чего оно заведено.
      status: r.complete ? "completed" : "draft",
      scores: r.scores,
    };

    lines.push(
      `insert into imported_reviews select (public.portal_save_quality_review(null, ${payloadLiteral(payload)}::jsonb) ->> 'id')::uuid;`,
    );
    emitted += 1;
  }
  lines.push("");
}

lines.push(`update public.quality_reviews set import_id = '${BATCH}'::uuid where id in (select id from imported_reviews);`);
lines.push("");

process.stdout.write(lines.join("\n"));
console.error(`\nSQL: ${emitted} проверок, пропущено ${skipped}. Пакет ${BATCH}`);
