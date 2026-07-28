import { describe, expect, it } from "vitest";
import { hasErrors, normalizeLogin, validateUserForm, type UserFormValues } from "./userForm";

function makeValues(overrides: Partial<UserFormValues> = {}): UserFormValues {
  return {
    fullName: "Иван Иванов",
    login: "ivanov",
    password: "sekret12",
    confirmPassword: "sekret12",
    role: "recruiter",
    projects: ["Самокат"],
    isActive: true,
    ...overrides,
  };
}

describe("validateUserForm — создание", () => {
  it("пропускает корректную форму", () => {
    expect(hasErrors(validateUserForm(makeValues(), "create"))).toBe(false);
  });

  it("требует ФИО", () => {
    expect(validateUserForm(makeValues({ fullName: " " }), "create").fullName).toBeDefined();
  });

  it("не принимает логин с недопустимыми символами, пробелами или верхним регистром", () => {
    expect(validateUserForm(makeValues({ login: "Иванов" }), "create").login).toBeDefined();
    expect(validateUserForm(makeValues({ login: "iv anov" }), "create").login).toBeDefined();
    expect(validateUserForm(makeValues({ login: "iv" }), "create").login).toBeDefined();
    // Верхний регистр нормализуется, а не отвергается.
    expect(validateUserForm(makeValues({ login: "Ivanov" }), "create").login).toBeUndefined();
  });

  it("требует пароль не короче 8 символов", () => {
    const errors = validateUserForm(makeValues({ password: "1234567", confirmPassword: "1234567" }), "create");
    expect(errors.password).toBeDefined();
  });

  it("требует совпадения пароля и подтверждения", () => {
    const errors = validateUserForm(makeValues({ confirmPassword: "sekret13" }), "create");
    expect(errors.confirmPassword).toBeDefined();
  });

  it("требует хотя бы один проект", () => {
    expect(validateUserForm(makeValues({ projects: [] }), "create").projects).toBeDefined();
  });
});

describe("validateUserForm — редактирование", () => {
  it("считает пустой пароль отказом от смены", () => {
    const errors = validateUserForm(makeValues({ password: "", confirmPassword: "" }), "edit");
    expect(hasErrors(errors)).toBe(false);
  });

  it("проверяет пароль, если его начали вводить", () => {
    const errors = validateUserForm(makeValues({ password: "123", confirmPassword: "" }), "edit");
    expect(errors.password).toBeDefined();
  });

  it("не проверяет логин: при редактировании он не меняется", () => {
    const errors = validateUserForm(makeValues({ login: "НЕВАЛИДНЫЙ ЛОГИН" }), "edit");
    expect(errors.login).toBeUndefined();
  });
});

describe("normalizeLogin", () => {
  it("приводит к нижнему регистру и убирает пробелы по краям", () => {
    expect(normalizeLogin("  Ivanov ")).toBe("ivanov");
  });
});
