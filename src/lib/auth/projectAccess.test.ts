import { describe, expect, it } from "vitest";
import { visibleProjectOptions } from "./projectAccess";

describe("visibleProjectOptions", () => {
  const allOptions = ["Газпромнефть", "Купер", "Самокат", "Яндекс Лавка"];

  it("head видит полный список независимо от своих projects", () => {
    expect(visibleProjectOptions("head", [], allOptions)).toEqual(allOptions);
    expect(visibleProjectOptions("head", ["Самокат"], allOptions)).toEqual(allOptions);
  });

  it("не-head роль видит только свои проекты", () => {
    expect(visibleProjectOptions("recruiter", ["Самокат"], allOptions)).toEqual(["Самокат"]);
  });

  it("не-head роль с несколькими проектами видит их все, но не остальные", () => {
    expect(visibleProjectOptions("coordinator", ["Купер", "Самокат"], allOptions)).toEqual(["Купер", "Самокат"]);
  });

  it("проект в userProjects, которого нет в allOptions, не появляется (справочник — источник истины)", () => {
    expect(visibleProjectOptions("manager", ["Несуществующий"], allOptions)).toEqual([]);
  });

  it("пустой userProjects даёт пустой список для не-head роли", () => {
    expect(visibleProjectOptions("recruiter", [], allOptions)).toEqual([]);
  });
});
