import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PORTAL_ROLES, allowedSections, permissionsForRole, type PortalRole } from "./roles";

/**
 * Сверка baseline матрицы прав (фаза A).
 *
 * Матрица переезжает из двух захардкоженных мест (ROLE_PERMISSIONS в
 * roles.ts и case внутри portal_role_sections()) в таблицу
 * public.portal_section_permissions. Пока переезд не завершён, обе версии
 * существуют одновременно, и главный риск всей задачи — расхождение между
 * ними: лишний true отдаёт роли данные, которых она сегодня не видит,
 * лишний false молча ломает работающий раздел на проде.
 *
 * Тест разбирает seed прямо из файла миграции и сравнивает его с roles.ts.
 * Это единственный способ сверить их без поднятой базы, поэтому проверка
 * живёт в обычном unit-наборе и идёт на каждый push, а не только в job с
 * эфемерным Postgres. Настоящую SQL-функцию против той же матрицы проверяет
 * src/testing/rls/sectionPermissions.rls-test.ts (нужен Docker).
 *
 * Тест намеренно завязан на текст миграции: править seed, не заметив, что
 * он разошёлся с roles.ts, не получится — сломается сборка.
 */

/**
 * Матрица собирается не из одного файла: baseline завёл её целиком, а
 * каждый новый раздел портала дописывает свои четыре строки и заново
 * объявляет portal_section_order(). Список идёт в порядке применения —
 * побеждает последнее определение порядка разделов, как и в самой базе.
 *
 * Новый раздел = новая миграция + строка в этом массиве. Забыть про него
 * не выйдет: без строки здесь тест увидит матрицу без раздела и упадёт на
 * сверке с roles.ts.
 */
const MIGRATION_FILES = [
  "20260811100000_portal_section_permissions.sql",
  "20260818100500_quality_section_permissions.sql",
];

const migrationSources = MIGRATION_FILES.map((name) =>
  readFileSync(fileURLToPath(new URL(`../../../supabase/migrations/${name}`, import.meta.url)), "utf8"),
);

const migrationSql = migrationSources.join("\n");

interface SeedRow {
  role: PortalRole;
  section: string;
  project: string | null;
  visible: boolean;
  canView: boolean;
  canEdit: boolean;
}

/** Разбирает строки VALUES вида `('head', 'overview', null, true, true, true)`. */
function parseSeed(sql: string): SeedRow[] {
  const rowPattern =
    /\(\s*'(head|coordinator|manager|recruiter)',\s*'([a-z_]+)',\s*(null|'[^']*'),\s*(true|false),\s*(true|false),\s*(true|false)\s*\)/g;

  return [...sql.matchAll(rowPattern)].map((match) => ({
    role: match[1] as PortalRole,
    section: match[2],
    project: match[3] === "null" ? null : match[3].slice(1, -1),
    visible: match[4] === "true",
    canView: match[5] === "true",
    canEdit: match[6] === "true",
  }));
}

/**
 * Разбирает канонический порядок разделов из portal_section_order().
 * Берётся последнее определение по порядку миграций: `create or replace`
 * в более поздней миграции переопределяет функцию, и база видит именно его.
 */
function parseSectionOrder(sources: string[]): string[] {
  const pattern = /create (?:or replace )?function public\.portal_section_order\(\)[\s\S]*?select array\[([\s\S]*?)\];/;

  for (const sql of [...sources].reverse()) {
    const body = pattern.exec(sql);
    if (body) return [...body[1].matchAll(/'([a-z_]+)'/g)].map((match) => match[1]);
  }

  throw new Error("Не найдено определение portal_section_order() ни в одной миграции");
}

/**
 * Повторяет логику portal_role_sections() из миграции 20260811100200:
 * разделы с can_view, упорядоченные по portal_section_order().
 */
function simulateRoleSections(seed: SeedRow[], order: string[], role: PortalRole): string[] {
  return seed
    .filter((row) => row.role === role && row.project === null && row.canView)
    .map((row) => row.section)
    .sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

const seed = parseSeed(migrationSql);
const sectionOrder = parseSectionOrder(migrationSources);

function rowFor(role: PortalRole, section: string): SeedRow {
  const row = seed.find((item) => item.role === role && item.section === section && item.project === null);
  if (!row) throw new Error(`В seed нет строки ${role}/${section}`);
  return row;
}

describe("portal_section_order() — канонический список прав", () => {
  it("совпадает с порядком меню из roles.ts плюс users", () => {
    // allowedSections('head') отдаёт SECTION_ORDER целиком: у роли есть все
    // разделы. `users` не пункт меню, поэтому дописан отдельно — и в
    // ROLE_PERMISSIONS.head он тоже последний.
    expect(sectionOrder).toEqual([...allowedSections("head"), "users"]);
  });
});

describe("baseline seed portal_section_permissions", () => {
  it("содержит ровно одну строку на каждую пару «роль × право»", () => {
    expect(seed).toHaveLength(PORTAL_ROLES.length * sectionOrder.length);

    const keys = seed.map((row) => `${row.role}/${row.section}`);
    expect(new Set(keys).size).toBe(seed.length);
  });

  it("в первой версии не содержит project-specific правил", () => {
    expect(seed.every((row) => row.project === null)).toBe(true);
  });

  it("использует только известные разделы", () => {
    for (const row of seed) {
      expect(sectionOrder).toContain(row.section);
    }
  });

  it("соблюдает инвариант can_edit => can_view => visible", () => {
    for (const row of seed) {
      if (row.canEdit) expect(row.canView).toBe(true);
      if (row.canView) expect(row.visible).toBe(true);
    }
  });
});

describe("equivalence: seed против ROLE_PERMISSIONS из roles.ts", () => {
  it.each(PORTAL_ROLES)("роль %s: набор can_view совпадает с текущими правами", (role) => {
    const fromSeed = seed
      .filter((row) => row.role === role && row.canView)
      .map((row) => row.section)
      .sort();
    const fromCode = [...permissionsForRole(role)].sort();

    expect(fromSeed).toEqual(fromCode);
  });

  it.each(PORTAL_ROLES)("роль %s: visible совпадает с can_view (в baseline скрытых разделов нет)", (role) => {
    for (const row of seed.filter((item) => item.role === role)) {
      expect(row.visible).toBe(row.canView);
    }
  });
});

describe("equivalence: simulated portal_role_sections() против roles.ts", () => {
  it.each(PORTAL_ROLES)("роль %s: массив совпадает побайтово, включая порядок", (role) => {
    // permissionsForRole отдаёт права в порядке меню, и прежняя реализация
    // portal_role_sections() перечисляла их так же — сравнение массивами,
    // а не множествами, ловит и расхождение в порядке.
    expect(simulateRoleSections(seed, sectionOrder, role)).toEqual([...permissionsForRole(role)]);
  });
});

describe("исключения, которые нельзя потерять при переносе", () => {
  it("vacancies: читают все четыре роли", () => {
    for (const role of PORTAL_ROLES) {
      expect(rowFor(role, "vacancies").canView).toBe(true);
    }
  });

  it("vacancies: редактируют только head и coordinator", () => {
    // Сегодня запись в vacancy_* требует vacancies AND settings
    // (20260805100500) — у manager и recruiter раздела settings нет.
    expect(rowFor("head", "vacancies").canEdit).toBe(true);
    expect(rowFor("coordinator", "vacancies").canEdit).toBe(true);
    expect(rowFor("manager", "vacancies").canEdit).toBe(false);
    expect(rowFor("recruiter", "vacancies").canEdit).toBe(false);
  });

  it("settings: редактируют только head и coordinator", () => {
    // От этого зависит запись в candidate_list_options, project_import_configs,
    // staffing_demand_imports и address_demand_history: в фазе C их политики
    // переводятся на portal_can_edit_section('settings').
    expect(rowFor("head", "settings").canEdit).toBe(true);
    expect(rowFor("coordinator", "settings").canEdit).toBe(true);
    expect(rowFor("manager", "settings").canEdit).toBe(false);
    expect(rowFor("recruiter", "settings").canEdit).toBe(false);
  });

  it("quality: manager читает, но не редактирует; recruiter не видит вовсе", () => {
    // Раздел заводит TASK-013. Права выданы стартовые: заполняют проверки
    // head и coordinator, руководитель группы только смотрит, а рекрутёру
    // раздел закрыт целиком — доступ к своим проверкам требует политики
    // «своя строка», которой в портале нет.
    expect(rowFor("head", "quality").canEdit).toBe(true);
    expect(rowFor("coordinator", "quality").canEdit).toBe(true);
    expect(rowFor("manager", "quality").canView).toBe(true);
    expect(rowFor("manager", "quality").canEdit).toBe(false);
    expect(rowFor("recruiter", "quality").visible).toBe(false);
    expect(rowFor("recruiter", "quality").canView).toBe(false);
  });

  it("users: право есть только у head", () => {
    expect(rowFor("head", "users").canView).toBe(true);
    expect(rowFor("coordinator", "users").canView).toBe(false);
    expect(rowFor("manager", "users").canView).toBe(false);
    expect(rowFor("recruiter", "users").canView).toBe(false);
  });

  it("candidates, addresses, rates: читают и редактируют все четыре роли", () => {
    for (const role of PORTAL_ROLES) {
      for (const section of ["candidates", "addresses", "rates"]) {
        expect(rowFor(role, section).canEdit).toBe(true);
      }
    }
  });

  it("recruiter не получает разделы, которых у него нет сегодня", () => {
    for (const section of ["overview", "demand", "marketing", "analytics", "settings", "users"]) {
      const row = rowFor("recruiter", section);
      expect(row.visible).toBe(false);
      expect(row.canView).toBe(false);
      expect(row.canEdit).toBe(false);
    }
  });
});
