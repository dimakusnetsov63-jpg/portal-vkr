import { describe, expect, it } from "vitest";
import type { PortalAuditAction, PortalAuditEntry } from "@/lib/supabase/portalAuth.types";
import { describeAuditEntry, formatAuditMoment } from "./auditText";

function entry(action: PortalAuditAction, details: Record<string, unknown> = {}, extra: Partial<PortalAuditEntry> = {}): PortalAuditEntry {
  return {
    id: "1",
    action,
    actor_login: "head",
    target_login: null,
    details,
    created_at: "2026-08-20T10:15:00Z",
    ...extra,
  };
}

describe("контроль качества: две формы одного поля", () => {
  it("создание пишет итог одним значением — и это не должно ронять панель", () => {
    // Настоящая запись с боевой базы. Прежний код делал `\"from\" in total`,
    // а `in` на числе бросает TypeError: падал рендер панели, а вместе с
    // ней — весь раздел «Настройки», потому что Error Boundary в портале нет.
    const text = describeAuditEntry(
      entry("quality_review_created", {
        kind: "call",
        status: "completed",
        project: "Самокат",
        review_id: "4a8e0084-0ef6-456b-8d94-b09f1db849ec",
        crm_lead_id: 123456,
        total_score: 83.44,
        employee_name: "Аекчит Анастасия",
      }),
    );

    expect(text).toContain("создал проверку качества: лид 123456, Аекчит Анастасия");
    expect(text).toContain("итог 83.44%");
    expect(text).toContain("статус: завершена");
  });

  it("архивация с пустым итогом показывает прочерк, а не «null%»", () => {
    const text = describeAuditEntry(
      entry("quality_review_archived", {
        project: "Самокат",
        crm_lead_id: 1,
        total_score: null,
        employee_name: "Минаев",
      }),
    );

    expect(text).toContain("убрал проверку в архив: лид 1, Минаев");
    expect(text).toContain("итог —");
  });

  it("правка пишет итог разницей и показывается переходом", () => {
    const text = describeAuditEntry(
      entry("quality_review_updated", {
        crm_lead_id: 777,
        employee_name: "Иванов",
        status: { from: "draft", to: "completed" },
        total_score: { from: null, to: 75 },
      }),
    );

    expect(text).toContain("статус черновик → завершена");
    expect(text).toContain("итог — → 75%");
  });

  it("изменённые пункты показываются первыми тремя со счётчиком остальных", () => {
    const text = describeAuditEntry(
      entry("quality_review_updated", {
        crm_lead_id: 1,
        employee_name: "Иванов",
        scores: [
          { item: "Приветствие", from: "0", to: "2" },
          { item: "Цель звонка", from: "1", to: "2" },
          { item: "Город", from: "0", to: "1" },
          { item: "Возраст", from: "0", to: "2" },
          { item: "Гражданство", from: "1", to: "2" },
        ],
      }),
    );

    expect(text).toContain("«Приветствие» 0 → 2");
    expect(text).toContain("и ещё 2");
    expect(text).not.toContain("Гражданство");
  });
});

describe("details — чужой JSON", () => {
  // Его пишут семь SECURITY DEFINER функций, у каждой своя форма, и она
  // меняется миграциями без оглядки на интерфейс. Ни одно поле нельзя
  // считать ни существующим, ни имеющим ожидаемый тип.

  it("пустой details не роняет строку", () => {
    expect(describeAuditEntry(entry("quality_review_created", {}))).toContain("лид —");
  });

  it("details не объектом не роняет строку", () => {
    const broken = entry("quality_review_created");
    (broken as { details: unknown }).details = "строка вместо объекта";

    expect(() => describeAuditEntry(broken)).not.toThrow();
  });

  it("поля неожиданных типов не роняют строку", () => {
    const text = describeAuditEntry(
      entry("quality_review_updated", {
        crm_lead_id: { непонятно: true },
        employee_name: 42,
        status: 7,
        total_score: "восемьдесят",
        scores: "не массив",
      }),
    );

    expect(text).toContain("лид —");
    expect(text).toBeTruthy();
  });

  it("мусор внутри списка изменений пропускается, а не ломает строку", () => {
    const text = describeAuditEntry(
      entry("quality_review_updated", {
        crm_lead_id: 5,
        employee_name: "Иванов",
        scores: [null, { нет: "item" }, { item: "Настоящий", from: "0", to: "2" }],
      }),
    );

    expect(text).toContain("«Настоящий» 0 → 2");
  });

  it("переход статуса с одной заполненной стороной не выдумывает вторую", () => {
    const text = describeAuditEntry(
      entry("quality_review_updated", { crm_lead_id: 1, employee_name: "И", status: { from: "draft" } }),
    );

    expect(text).not.toContain("→");
  });
});

describe("остальные действия", () => {
  it("неудачный вход называет логин и причину", () => {
    const text = describeAuditEntry(
      entry("login_failed", { reason: "disabled" }, { actor_login: null, target_login: "petrov" }),
    );

    expect(text).toBe("неудачная попытка входа: @petrov (учётная запись отключена)");
  });

  it("вход и выход не приписывают цель", () => {
    expect(describeAuditEntry(entry("login_success"))).toBe("@head вошёл в портал");
    expect(describeAuditEntry(entry("logout"))).toBe("@head вышел из портала");
  });

  it("смена роли показывает переход", () => {
    const text = describeAuditEntry(
      entry("user_role_changed", { from: "manager", to: "coordinator" }, { target_login: "petrov" }),
    );

    expect(text).toBe("@head сменил роль @petrov: manager → coordinator");
  });

  it("смена роли без деталей не пишет «undefined»", () => {
    const text = describeAuditEntry(entry("user_role_changed", {}, { target_login: "petrov" }));

    expect(text).not.toContain("undefined");
    expect(text).toContain("— → —");
  });

  it("действие без автора приписывается системе", () => {
    expect(describeAuditEntry(entry("user_created", {}, { actor_login: null, target_login: "x" }))).toContain("Система");
  });

  it("неизвестное действие показывается кодом, а не «undefined»", () => {
    // Значения enum добавляются миграцией, а интерфейс узнаёт о них позже.
    const unknown = entry("quality_review_created");
    (unknown as { action: string }).action = "какое_то_новое_действие";

    expect(describeAuditEntry(unknown)).toContain("какое_то_новое_действие");
  });
});

describe("formatAuditMoment", () => {
  it("битая дата даёт прочерк, а не «Invalid Date»", () => {
    expect(formatAuditMoment("не дата")).toBe("—");
  });

  it("нормальная дата форматируется", () => {
    expect(formatAuditMoment("2026-08-20T10:15:00Z")).toMatch(/^\d{2}\.\d{2}, \d{2}:\d{2}$/);
  });
});
