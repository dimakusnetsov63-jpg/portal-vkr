import { describe, expect, it } from "vitest";
import { SECTION_ORDER, isLockedCell, sectionsInMenuOrder, toMatrix } from "./accessMatrix";
import type { SectionPermissionRow } from "@/lib/supabase/portalAuth.types";

function row(
  role: SectionPermissionRow["role"],
  section: string,
  visible: boolean,
  canView: boolean,
  canEdit: boolean,
): SectionPermissionRow {
  return {
    role,
    section,
    visible,
    can_view: canView,
    can_edit: canEdit,
    updated_at: "2026-08-13T00:00:00Z",
  };
}

describe("toMatrix", () => {
  it("раскладывает плоский ответ RPC по ролям и разделам", () => {
    const matrix = toMatrix([
      row("head", "candidates", true, true, true),
      row("recruiter", "candidates", true, true, false),
      row("recruiter", "demand", false, false, false),
    ]);

    expect(matrix.head.candidates).toEqual({ visible: true, can_view: true, can_edit: true });
    expect(matrix.recruiter.candidates).toEqual({ visible: true, can_view: true, can_edit: false });
    expect(matrix.recruiter.demand).toEqual({ visible: false, can_view: false, can_edit: false });
  });

  it("пустой ответ даёт пустую матрицу, а не падение", () => {
    expect(toMatrix([])).toEqual({});
  });
});

describe("sectionsInMenuOrder", () => {
  it("сортирует по порядку меню, а не по порядку ответа", () => {
    const matrix = toMatrix([
      row("head", "settings", true, true, true),
      row("head", "overview", true, true, true),
      row("head", "candidates", true, true, true),
    ]);
    expect(sectionsInMenuOrder(matrix)).toEqual(["overview", "candidates", "settings"]);
  });

  it("незнакомый раздел не теряется — уходит в конец", () => {
    // Раздел добавили в portal_section_order(), но не в SECTION_LABELS:
    // управлять им всё равно надо, иначе право будет недостижимо из UI.
    const matrix = toMatrix([
      row("head", "candidates", true, true, true),
      row("head", "brand_new_section", false, false, false),
    ]);
    expect(sectionsInMenuOrder(matrix)).toEqual(["candidates", "brand_new_section"]);
  });

  it("собирает разделы из всех ролей, а не только из первой", () => {
    const matrix = toMatrix([
      row("head", "candidates", true, true, true),
      row("recruiter", "rates", true, true, true),
    ]);
    expect(sectionsInMenuOrder(matrix)).toEqual(["candidates", "rates"]);
  });

  it("users идёт последним — это право, а не пункт меню", () => {
    expect(SECTION_ORDER[SECTION_ORDER.length - 1]).toBe("users");
  });
});

describe("isLockedCell", () => {
  it("у head заблокированы «Настройки» и «Учётные записи»", () => {
    expect(isLockedCell("head", "settings")).toBe(true);
    expect(isLockedCell("head", "users")).toBe(true);
  });

  it("остальные разделы у head редактируются", () => {
    expect(isLockedCell("head", "candidates")).toBe(false);
    expect(isLockedCell("head", "analytics")).toBe(false);
  });

  it("у других ролей те же разделы не заблокированы", () => {
    // Отобрать «Настройки» у координатора можно — портал от этого не
    // становится неуправляемым, руководитель остаётся.
    expect(isLockedCell("coordinator", "settings")).toBe(false);
    expect(isLockedCell("coordinator", "users")).toBe(false);
    expect(isLockedCell("manager", "settings")).toBe(false);
  });
});
