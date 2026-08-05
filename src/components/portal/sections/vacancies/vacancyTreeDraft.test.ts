import { describe, expect, it } from "vitest";
import { buildDraftFromTree, reorderFields, reorderSections, sectionHasVisibleContent, sectionMatchesQuery } from "./vacancyTreeDraft";
import type { VacancyProjectTree, VacancySectionWithChildren } from "@/lib/supabase/vacancyProjects.types";

function makeTree(): VacancyProjectTree {
  return {
    project: {
      id: "p1",
      title: "Курьер",
      category_option_id: "cat1",
      version: 3,
      archived_at: null,
      created_at: "",
      updated_at: "",
      created_by: null,
      created_by_login: null,
      updated_by: null,
      updated_by_login: null,
      category_option: { id: "cat1", value: "Курьеры и доставка" },
    },
    sections: [
      {
        id: "s1",
        vacancy_project_id: "p1",
        title: "Общая информация",
        icon: "info",
        is_system: true,
        sort_order: 0,
        archived_at: null,
        created_at: "",
        updated_at: "",
        fields: [{ id: "f1", section_id: "s1", label: "Профиль", value: "Курьер", field_type: "text", sort_order: 0, created_at: "", updated_at: "" }],
        attachments: [],
      },
      {
        id: "s2",
        vacancy_project_id: "p1",
        title: "График работы",
        icon: "clock",
        is_system: false,
        sort_order: 1,
        archived_at: null,
        created_at: "",
        updated_at: "",
        fields: [],
        attachments: [],
      },
    ],
    generalAttachments: [],
  };
}

describe("buildDraftFromTree", () => {
  it("переносит title/category_option_id и все разделы/поля дерева", () => {
    const draft = buildDraftFromTree(makeTree());
    expect(draft.title).toBe("Курьер");
    expect(draft.category_option_id).toBe("cat1");
    expect(draft.sections).toHaveLength(2);
    expect(draft.sections[0].fields).toEqual([{ id: "f1", label: "Профиль", value: "Курьер", field_type: "text", sort_order: 0 }]);
  });
});

describe("sectionHasVisibleContent", () => {
  it("раздел с непустым полем виден", () => {
    expect(sectionHasVisibleContent(makeTree().sections[0])).toBe(true);
  });

  it("раздел без полей и вложений скрыт", () => {
    expect(sectionHasVisibleContent(makeTree().sections[1])).toBe(false);
  });

  it("раздел с вложением виден, даже если все поля пустые", () => {
    const section: VacancySectionWithChildren = {
      ...makeTree().sections[1],
      attachments: [{ id: "a1", vacancy_project_id: "p1", section_id: "s2", title: "PDF", url: "https://x", type: "pdf", sort_order: 0, created_at: "" }],
    };
    expect(sectionHasVisibleContent(section)).toBe(true);
  });
});

describe("reorderSections", () => {
  it("меняет местами раздел с предыдущим и пересчитывает sort_order", () => {
    const draft = buildDraftFromTree(makeTree());
    const reordered = reorderSections(draft, 1, "up");
    expect(reordered.sections.map((s) => s.title)).toEqual(["График работы", "Общая информация"]);
    expect(reordered.sections.map((s) => s.sort_order)).toEqual([0, 1]);
  });

  it("не двигает первый раздел вверх", () => {
    const draft = buildDraftFromTree(makeTree());
    const reordered = reorderSections(draft, 0, "up");
    expect(reordered.sections.map((s) => s.title)).toEqual(["Общая информация", "График работы"]);
  });
});

describe("sectionMatchesQuery", () => {
  it("пустой запрос не совпадает никогда", () => {
    const draft = buildDraftFromTree(makeTree());
    expect(sectionMatchesQuery(draft.sections[0], "")).toBe(false);
  });

  it("совпадает по названию раздела", () => {
    const draft = buildDraftFromTree(makeTree());
    expect(sectionMatchesQuery(draft.sections[1], "график")).toBe(true);
  });

  it("совпадает по значению поля", () => {
    const draft = buildDraftFromTree(makeTree());
    expect(sectionMatchesQuery(draft.sections[0], "курьер")).toBe(true);
  });

  it("не совпадает, если запроса нигде нет", () => {
    const draft = buildDraftFromTree(makeTree());
    expect(sectionMatchesQuery(draft.sections[0], "патент")).toBe(false);
  });
});

describe("reorderFields", () => {
  it("переставляет поля внутри конкретного раздела, не трогая остальные", () => {
    const draft = buildDraftFromTree(makeTree());
    const withExtraField = {
      ...draft,
      sections: draft.sections.map((s, i) =>
        i === 0 ? { ...s, fields: [...s.fields, { id: "f2", label: "Регион", value: "Москва", field_type: "text" as const, sort_order: 1 }] } : s,
      ),
    };
    const reordered = reorderFields(withExtraField, 0, 1, "up");
    expect(reordered.sections[0].fields.map((f) => f.label)).toEqual(["Регион", "Профиль"]);
    expect(reordered.sections[1]).toEqual(withExtraField.sections[1]);
  });
});
