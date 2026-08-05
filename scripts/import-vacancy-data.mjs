#!/usr/bin/env node
// One-time transfer of the old Excel "Описание вакансий" workbook into the
// new Supabase-backed "Описание вакансии" section (TASK-010). NOT a
// generator that runs on every release — vacancy_projects/vacancy_sections/
// vacancy_fields are the source of truth from now on; this script is used
// exactly once (or once per legacy Excel a coordinator still has lying
// around) and then never again. See docs/requirements/vacancies.md.
//
// The workbook has no real table structure — each sheet is a project, laid
// out as loose "label -> text" rows (column A = label, columns B.. = the
// value, sometimes split across several cells), with typos and inconsistent
// spelling of the same field across sheets (confirmed by a frequency count
// across all 44 sheets of the original file — see the ТЗ discussion in the
// project's task history). This script applies the same keyword heuristic
// used there to sort labels into the fixed set of sections the new editor
// seeds by default; anything unrecognized goes into "Дополнительная
// информация" (a completely ordinary, renameable/deletable section, not a
// hardcoded bucket).
//
// This is a best-effort draft transfer, not a guarantee of correctness —
// head/coordinator are expected to review and clean up each imported
// vacancy afterward in the new editor (that's the whole point of building
// it). Output is written to a local JSON file for review; nothing touches
// Supabase unless --apply is passed.
//
// Usage:
//   node scripts/import-vacancy-data.mjs <path-to.xlsx> [--out preview.json] [--apply]
//
// --apply requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the
// environment (never NEXT_PUBLIC_* — the service role key must never reach
// client code, see CLAUDE.md rule 5; this script runs standalone in Node,
// outside the Next.js app bundle, and is never imported by portal code).

import { writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import ExcelJS from "exceljs";

const SECTION_RULES = [
  { title: "График работы", icon: "clock", pattern: /график|время работ|радиус|расстояни|количество заказ|рабочий день|норма выработк/i },
  { title: "Обязанности", icon: "target", pattern: /обязанност/i },
  { title: "Требования", icon: "shield", pattern: /треб|возраст|гражданств|документ|патент|мед\.?\s*книжк|русск.{0,10}язык|телефон|права|автомобил/i },
  { title: "Доход и выплаты", icon: "cash", pattern: /оплат|выплат|ставк|зарплат|з\/п|заработн|тариф|стоимост.{0,10}час|объем по заказ/i },
  { title: "Акции и бонусы", icon: "gift", pattern: /акци|бонус|преимущ/i },
  { title: "Условия работы", icon: "box", pattern: /инвентар|форма\b|выдач|аренд|транспорт|топливн|склад загрузк|рабочее мест/i },
  { title: "Оформление", icon: "file", pattern: /оформлен|способ оформ/i },
  { title: "Этапы трудоустройства", icon: "graduation", pattern: /интервью|собеседован|стажир|обучен|дедублик|переориентир|^чс\b/i },
];

function classifyLabel(label) {
  for (const rule of SECTION_RULES) {
    if (rule.pattern.test(label)) return rule;
  }
  return { title: "Дополнительная информация", icon: "info" };
}

/** Cells beyond column A, joined into one value — the source sheets sometimes split one value across several columns (side notes, per-city variants). */
function joinRestOfRow(row, labelColIndex) {
  const parts = [];
  for (let col = labelColIndex + 1; col <= row.cellCount; col++) {
    const cell = row.getCell(col);
    const text = cellText(cell);
    if (text) parts.push(text);
  }
  return parts.join("\n").trim();
}

function cellText(cell) {
  if (cell.value === null || cell.value === undefined) return "";
  if (typeof cell.value === "object" && "richText" in cell.value) {
    return cell.value.richText.map((r) => r.text).join("");
  }
  return String(cell.text ?? cell.value).trim();
}

function parseWorksheet(sheet) {
  const title = sheet.name.trim();

  // First pass: count how often each column-A value repeats. The source
  // sheets fill the first few unlabeled rows (general description/schedule/
  // requirements) with the project's own display name instead of leaving
  // column A blank — e.g. sheet "Сборщик_Самокат_" repeats "Сборщик заказов
  // Самокат" in column A, which does not match the sheet tab name itself.
  // A real field label appears once per sheet; this filler repeats several
  // times, so the most frequent non-empty label is treated as filler rather
  // than comparing against the sheet name alone.
  const labelCounts = new Map();
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const label = cellText(row.getCell(1));
    if (!label) return;
    labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
  });
  let fillerLabel = title;
  let fillerCount = 1;
  for (const [label, count] of labelCounts) {
    if (count > fillerCount) {
      fillerLabel = label;
      fillerCount = count;
    }
  }

  const generalFields = [{ label: "Профиль", value: fillerLabel !== title ? fillerLabel : "", field_type: "text" }];
  const sectionFields = new Map(); // section title -> field[]

  sheet.eachRow({ includeEmpty: false }, (row) => {
    const labelCell = row.getCell(1);
    const rawLabel = cellText(labelCell);
    const value = joinRestOfRow(row, 1);
    if (!value) return;

    // Filler rows (see above) go into "Общая информация" as untitled
    // description text, matching how the old static vacancyData.ts
    // generator displayed them (label: "").
    if (!rawLabel || rawLabel === title || rawLabel === fillerLabel) {
      generalFields.push({ label: "Дополнительное описание", value, field_type: "rich_text" });
      return;
    }

    const { title: sectionTitle } = classifyLabel(rawLabel);
    const fields = sectionFields.get(sectionTitle) ?? [];
    fields.push({ label: rawLabel, value, field_type: value.includes("\n") || value.length > 200 ? "rich_text" : "text" });
    sectionFields.set(sectionTitle, fields);
  });

  const sections = [
    { title: "Общая информация", icon: "info", is_system: true, fields: generalFields },
    ...SECTION_RULES.map((r) => ({ title: r.title, icon: r.icon, is_system: false, fields: sectionFields.get(r.title) ?? [] })).filter(
      (s) => s.fields.length > 0,
    ),
  ];
  const otherFields = sectionFields.get("Дополнительная информация");
  if (otherFields?.length) {
    sections.push({ title: "Дополнительная информация", icon: "info", is_system: false, fields: otherFields });
  }

  return { title, sections };
}

/**
 * Retries a Supabase call a few times on transient network failures
 * ("fetch failed" / "terminated" — connection reset mid-request, seen in
 * practice on flaky home connections importing ~44 vacancies × several
 * sequential requests each). Not retried indefinitely: after the last
 * attempt the original `{ data: null, error }` shape is returned so the
 * caller's existing error handling/logging is unchanged.
 */
async function withRetry(fn, attempts = 5, baseDelayMs = 600) {
  let result;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    result = await fn();
    if (!result.error) return result;
    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * attempt));
    }
  }
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const filePath = args.find((a) => !a.startsWith("--"));
  const apply = args.includes("--apply");
  const outIndex = args.indexOf("--out");
  const outPath = outIndex !== -1 ? args[outIndex + 1] : path.join(process.cwd(), "vacancy-import-preview.json");

  if (!filePath) {
    console.error("Usage: node scripts/import-vacancy-data.mjs <path-to.xlsx> [--out preview.json] [--apply]");
    process.exit(1);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const projects = workbook.worksheets.map(parseWorksheet).filter((p) => p.sections.some((s) => s.fields.length > 0));

  writeFileSync(outPath, JSON.stringify(projects, null, 2), "utf8");
  console.log(`Разобрано ${projects.length} вакансий из ${workbook.worksheets.length} листов -> ${outPath}`);
  console.log("Проверьте файл перед применением — разметка по разделам эвристическая, не идеальная.");

  if (!apply) {
    console.log("Готово (--apply не передан, в Supabase ничего не записано).");
    return;
  }

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    console.error("--apply требует SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в переменных окружения (не NEXT_PUBLIC_*).");
    process.exit(1);
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, serviceRoleKey);

  for (const project of projects) {
    const { data: projectRow, error: projectError } = await withRetry(() =>
      supabase.from("vacancy_projects").insert({ title: project.title }).select().single(),
    );
    if (projectError) {
      console.error(`Пропущена вакансия «${project.title}»: ${projectError.message}`);
      continue;
    }

    for (const [sectionIndex, section] of project.sections.entries()) {
      const { data: sectionRow, error: sectionError } = await withRetry(() =>
        supabase
          .from("vacancy_sections")
          .insert({
            vacancy_project_id: projectRow.id,
            title: section.title,
            icon: section.icon,
            is_system: section.is_system,
            sort_order: sectionIndex,
          })
          .select()
          .single(),
      );
      if (sectionError) {
        console.error(`  Раздел «${section.title}» не создан: ${sectionError.message}`);
        continue;
      }

      const fieldRows = section.fields.map((f, i) => ({
        section_id: sectionRow.id,
        label: f.label,
        value: f.value,
        field_type: f.field_type,
        sort_order: i,
      }));
      const { error: fieldsError } = await withRetry(() => supabase.from("vacancy_fields").insert(fieldRows));
      if (fieldsError) {
        console.error(`  Поля раздела «${section.title}» не вставлены: ${fieldsError.message}`);
      }
    }

    console.log(`Импортирована вакансия «${project.title}» (${projectRow.id})`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
