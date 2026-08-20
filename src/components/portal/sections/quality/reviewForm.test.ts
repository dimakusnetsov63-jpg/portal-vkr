import { describe, expect, it } from "vitest";
import { validateReviewForm, type ReviewFormContext, type ReviewFormValues } from "./reviewForm";

function values(overrides: Partial<ReviewFormValues> = {}): ReviewFormValues {
  return {
    project: "Самокат",
    leadInput: "3660718",
    employeeName: "Иванов Иван",
    outboundCalls: "",
    ...overrides,
  };
}

function context(overrides: Partial<ReviewFormContext> = {}): ReviewFormContext {
  return { hasChecklist: true, unanswered: 0, status: "completed", ...overrides };
}

describe("validateReviewForm", () => {
  it("пропускает заполненную форму и отдаёт разобранный номер лида", () => {
    const result = validateReviewForm(values(), context());
    expect(result).toEqual({ ok: true, leadId: 3660718, employeeName: "Иванов Иван" });
  });

  it("принимает ссылку на лид вместо номера", () => {
    const result = validateReviewForm(
      values({ leadInput: "https://portal.sth-group.ru/crm/lead/details/3660718/" }),
      context(),
    );
    expect(result).toEqual({ ok: true, leadId: 3660718, employeeName: "Иванов Иван" });
  });

  it("нормализует имя сотрудника так же, как база", () => {
    const result = validateReviewForm(values({ employeeName: "  Иванов   Иван  " }), context());
    expect(result).toEqual({ ok: true, leadId: 3660718, employeeName: "Иванов Иван" });
  });

  it("отвергает имя из одних пробелов — оно только выглядит заполненным", () => {
    const result = validateReviewForm(values({ employeeName: "   " }), context());
    expect(result).toEqual({ ok: false, message: expect.stringContaining("сотрудника") });
  });

  it("отвергает пустой проект", () => {
    const result = validateReviewForm(values({ project: "" }), context());
    expect(result).toEqual({ ok: false, message: expect.stringContaining("проект") });
  });

  it("отвергает лид, из которого не вытащить номер", () => {
    const result = validateReviewForm(values({ leadInput: "ссылки нет" }), context());
    expect(result).toEqual({ ok: false, message: expect.stringContaining("лида") });
  });

  it("сообщает про отсутствующий шаблон раньше остальных проверок", () => {
    // Без шаблона заполнять нечего, и жаловаться на пустой проект в этот
    // момент — сбивать с толку.
    const result = validateReviewForm(values({ project: "", leadInput: "" }), context({ hasChecklist: false }));
    expect(result).toEqual({ ok: false, message: expect.stringContaining("шаблон") });
  });

  it("не даёт завершить проверку с незаполненными пунктами", () => {
    const result = validateReviewForm(values(), context({ unanswered: 4, status: "completed" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("осталось 4");
  });

  it("черновик с пропусками сохранить разрешает", () => {
    const result = validateReviewForm(values(), context({ unanswered: 4, status: "draft" }));
    expect(result.ok).toBe(true);
  });

  it.each(["-1", "1.5", "не число"])("отвергает счётчик звонков «%s»", (calls) => {
    const result = validateReviewForm(values({ outboundCalls: calls }), context());
    expect(result).toEqual({ ok: false, message: expect.stringContaining("исходящих") });
  });

  it("пустой счётчик звонков допустим — поле необязательное", () => {
    expect(validateReviewForm(values({ outboundCalls: "" }), context()).ok).toBe(true);
  });

  it("ноль исходящих звонков — валидное значение, а не пропуск", () => {
    expect(validateReviewForm(values({ outboundCalls: "0" }), context()).ok).toBe(true);
  });
});
