import type { PortalAuditAction, PortalAuditEntry } from "@/lib/supabase/portalAuth.types";

/**
 * Текст строки журнала действий.
 *
 * Вынесено из `AuditLogPanel` после падения на бою: у записи «создал
 * проверку качества» поле `details.total_score` — обычное число, а код
 * считал, что там всегда разница `{from, to}`, и делал `"from" in total`.
 * Оператор `in` на числе бросает TypeError, рендер панели падал, а Error
 * Boundary в портале нет — вместе с панелью уходил весь раздел «Настройки».
 *
 * Отсюда и правило для этого модуля: **`details` — это чужой JSON**. Его
 * пишут семь разных SECURITY DEFINER функций, у каждой своя форма, и она
 * меняется миграциями без оглядки на интерфейс. Ни одно поле нельзя считать
 * ни существующим, ни имеющим ожидаемый тип; каждое проверяется перед
 * использованием, а не приводится через `as`.
 */

const ACTION_LABELS: Record<PortalAuditAction, string> = {
  user_created: "создал пользователя",
  user_updated: "изменил пользователя",
  user_role_changed: "сменил роль",
  user_password_changed: "изменил пароль",
  user_activated: "включил доступ",
  user_deactivated: "отключил доступ",
  login_success: "вошёл в портал",
  login_failed: "неудачная попытка входа",
  logout: "вышел из портала",
  section_permission_changed: "изменил права роли",
  user_projects_changed: "изменил проекты пользователя",
  quality_review_created: "создал проверку качества",
  quality_review_updated: "изменил проверку качества",
  quality_review_archived: "убрал проверку в архив",
  quality_review_restored: "вернул проверку в работу",
};

const STATUS_TEXT: Record<string, string> = {
  draft: "черновик",
  completed: "завершена",
};

const QUALITY_ACTIONS: PortalAuditAction[] = [
  "quality_review_created",
  "quality_review_updated",
  "quality_review_archived",
  "quality_review_restored",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/** Процент к показу. `null` — «считать было не из чего», это не ноль. */
function formatScore(value: unknown): string {
  return typeof value === "number" ? `${value}%` : "—";
}

/**
 * Поле журнала бывает двух форм: у создания и архивации это само значение,
 * у правки — разница `{from, to}`. Различать их нужно по факту, а не по
 * названию действия: форму задаёт SQL-функция, и добавление нового действия
 * не должно требовать правки этого списка.
 */
function readChange(value: unknown): { from: unknown; to: unknown } | null {
  if (!isRecord(value)) return null;
  if (!("from" in value) && !("to" in value)) return null;
  return { from: value.from, to: value.to };
}

/** Одна строка разницы по пункту чек-листа. */
function describeScoreChange(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const item = asText(value.item);
  if (!item) return null;
  return `«${item}» ${String(value.from ?? "—")} → ${String(value.to ?? "—")}`;
}

/**
 * Событие раздела «Контроль качества» описывается не через `target_login` —
 * цели-пользователя у него нет, — а через опознавательные поля в `details`:
 * лид, сотрудник. У правки дополнительно показывается, что изменилось:
 * переход статуса, сдвиг итога и первые изменённые пункты. Полный список
 * остаётся в `details`: панель не должна разрастаться до тридцати пяти
 * строк на одну запись.
 */
function describeQualityReview(entry: PortalAuditEntry, actor: string, action: string): string {
  const details = isRecord(entry.details) ? entry.details : {};
  const lead = typeof details.crm_lead_id === "number" ? details.crm_lead_id : (asText(details.crm_lead_id) ?? "—");
  const employee = asText(details.employee_name) ?? "—";
  const head = `${actor} ${action}: лид ${lead}, ${employee}`;

  const parts: string[] = [];

  const statusChange = readChange(details.status);
  if (statusChange) {
    const from = asText(statusChange.from);
    const to = asText(statusChange.to);
    if (from && to) parts.push(`статус ${STATUS_TEXT[from] ?? from} → ${STATUS_TEXT[to] ?? to}`);
  } else {
    const status = asText(details.status);
    if (status) parts.push(`статус: ${STATUS_TEXT[status] ?? status}`);
  }

  const totalChange = readChange(details.total_score);
  if (totalChange) {
    parts.push(`итог ${formatScore(totalChange.from)} → ${formatScore(totalChange.to)}`);
  } else if ("total_score" in details) {
    // Создание и архивация пишут итог одним значением, а не разницей.
    parts.push(`итог ${formatScore(details.total_score)}`);
  }

  const scores = Array.isArray(details.scores) ? details.scores : [];
  const shown = scores.slice(0, 3).map(describeScoreChange).filter((text): text is string => text !== null);
  if (shown.length > 0) {
    parts.push(scores.length > 3 ? `${shown.join("; ")} и ещё ${scores.length - 3}` : shown.join("; "));
  }

  return parts.length > 0 ? `${head} — ${parts.join("; ")}` : head;
}

export function describeAuditEntry(entry: PortalAuditEntry): string {
  const actor = entry.actor_login ? `@${entry.actor_login}` : "Система";
  // Неизвестное действие не должно превращаться в «undefined»: значения
  // enum добавляются миграцией, а интерфейс о них узнаёт позже.
  const action = ACTION_LABELS[entry.action] ?? entry.action;
  const details = isRecord(entry.details) ? entry.details : {};

  if (entry.action === "login_failed") {
    const login = entry.target_login ? `@${entry.target_login}` : "неизвестный логин";
    const reason = details.reason === "disabled" ? " (учётная запись отключена)" : "";
    return `${action}: ${login}${reason}`;
  }
  if (entry.action === "login_success" || entry.action === "logout") {
    return `${actor} ${action}`;
  }
  if (entry.action === "user_role_changed") {
    const change = readChange(details);
    const from = asText(change?.from) ?? "—";
    const to = asText(change?.to) ?? "—";
    return `${actor} ${action} @${entry.target_login ?? "—"}: ${from} → ${to}`;
  }
  if (QUALITY_ACTIONS.includes(entry.action)) {
    return describeQualityReview(entry, actor, action);
  }
  return `${actor} ${action} @${entry.target_login ?? "—"}`;
}

export function formatAuditMoment(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })}, ${date.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}
