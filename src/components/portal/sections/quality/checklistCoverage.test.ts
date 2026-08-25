import { describe, expect, it } from "vitest";
import type { QualityChecklistRow } from "@/lib/supabase/quality.types";
import { checklistCoverage } from "./checklistCoverage";

function checklist(overrides: Partial<QualityChecklistRow>): QualityChecklistRow {
  return {
    id: Math.random().toString(36).slice(2),
    kind: "call",
    project: null,
    title: "Шаблон",
    archived_at: null,
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    created_by: null,
    updated_by: null,
    version: 1,
    ...overrides,
  } as QualityChecklistRow;
}

const projects = ["Самокат", "Купер", "Газпромнефть"];

describe("checklistCoverage", () => {
  it("проект со своим шаблоном не считается работающим по общему", () => {
    const rows = [checklist({ project: null }), checklist({ project: "Газпромнефть" })];
    const [call] = checklistCoverage(rows, projects, ["call"]);

    expect(call.own).toEqual(["Газпромнефть"]);
    expect(call.fallback).toEqual(["Самокат", "Купер"]);
    expect(call.missing).toEqual([]);
    expect(call.hasCommon).toBe(true);
  });

  it("без общего шаблона проекты без своего остаются вообще без чек-листа", () => {
    // Ровно тот случай, ради которого функция и написана: единственный общий
    // шаблон переназначили на один проект, и остальные молча осели без
    // шаблона — заметить это было негде.
    const [call] = checklistCoverage([checklist({ project: "Газпромнефть" })], projects, ["call"]);

    expect(call.hasCommon).toBe(false);
    expect(call.own).toEqual(["Газпромнефть"]);
    expect(call.fallback).toEqual([]);
    expect(call.missing).toEqual(["Самокат", "Купер"]);
  });

  it("архивный шаблон не считается ни своим, ни общим", () => {
    const rows = [
      checklist({ project: null, archived_at: "2026-08-20T00:00:00Z" }),
      checklist({ project: "Самокат", archived_at: "2026-08-20T00:00:00Z" }),
    ];
    const [call] = checklistCoverage(rows, projects, ["call"]);

    expect(call.hasCommon).toBe(false);
    expect(call.own).toEqual([]);
    expect(call.missing).toEqual(projects);
  });

  it("шаблон чужого вида не закрывает проект", () => {
    const rows = [checklist({ kind: "refusal", project: "Самокат" })];
    const [call] = checklistCoverage(rows, projects, ["call"]);

    expect(call.own).toEqual([]);
    expect(call.missing).toEqual(projects);
  });

  it("виды считаются независимо", () => {
    const rows = [checklist({ kind: "call", project: "Самокат" }), checklist({ kind: "refusal", project: null })];
    const [call, refusal] = checklistCoverage(rows, projects);

    expect(call.own).toEqual(["Самокат"]);
    expect(call.missing).toEqual(["Купер", "Газпромнефть"]);
    expect(refusal.fallback).toEqual(projects);
  });

  it("шаблон проекта, которого нет в справочнике, никого не закрывает", () => {
    // Проект могли переименовать или отключить: шаблон остался, а подбор по
    // точному совпадению строки его больше не найдёт.
    const [call] = checklistCoverage([checklist({ project: "Криспи" })], projects, ["call"]);

    expect(call.own).toEqual([]);
    expect(call.missing).toEqual(projects);
  });

  it("порядок проектов сохраняется — списки читает человек", () => {
    const [call] = checklistCoverage([checklist({ project: null })], projects, ["call"]);

    expect(call.fallback).toEqual(projects);
  });

  it("пустой справочник проектов не роняет расчёт", () => {
    const [call] = checklistCoverage([checklist({ project: null })], [], ["call"]);

    expect(call.hasCommon).toBe(true);
    expect(call.own).toEqual([]);
    expect(call.fallback).toEqual([]);
    expect(call.missing).toEqual([]);
  });
});
