"use client";

import { useRef } from "react";
import { Icon } from "@/components/portal/ui/Icon";
import primitives from "@/components/portal/ui/primitives.module.css";
import type { VacancyFieldDraft, VacancyFieldType } from "@/lib/supabase/vacancyProjects.types";
import { FieldValueView } from "./FieldValueView";
import { insertLink, toggleBulletLines, wrapSelection } from "./vacancyMarkdown";
import styles from "./VacancyDetail.module.css";

const FIELD_TYPE_LABELS: Record<VacancyFieldType, string> = {
  text: "Текст",
  textarea: "Многострочный текст",
  rich_text: "Форматированный текст",
  link: "Ссылка",
  number: "Число",
  date: "Дата",
  checkbox: "Да/нет",
  select: "Выбор из списка",
};

const EDITABLE_FIELD_TYPES: VacancyFieldType[] = ["text", "textarea", "rich_text", "link", "number", "date", "checkbox"];

/** Одно поле раздела — режим чтения (label + FieldValueView) или редактирования (инпут по field_type + панель форматирования для rich_text). */
export function VacancyFieldEditor({
  field,
  editing,
  highlightQuery,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: {
  field: VacancyFieldDraft;
  editing: boolean;
  highlightQuery?: string;
  onChange: (patch: Partial<VacancyFieldDraft>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  if (!editing) {
    if (field.value.trim() === "") return null;
    return (
      <div className={styles.fieldRow}>
        {field.label && <span className={styles.fieldLabel}>{field.label}</span>}
        <FieldValueView fieldType={field.field_type} value={field.value} highlightQuery={highlightQuery} />
      </div>
    );
  }

  function applyMarkup(fn: (value: string, start: number, end: number) => { value: string; selectionStart: number; selectionEnd: number }) {
    const el = textareaRef.current;
    if (!el) return;
    const result = fn(field.value, el.selectionStart, el.selectionEnd);
    onChange({ value: result.value });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(result.selectionStart, result.selectionEnd);
    });
  }

  return (
    <div className={styles.fieldEditRow}>
      <div className={primitives.fieldRow}>
        <input
          className={styles.fieldLabelInput}
          type="text"
          placeholder="Подпись поля"
          value={field.label}
          onChange={(e) => onChange({ label: e.target.value })}
        />
        <select
          className={styles.fieldTypeSelect}
          value={field.field_type}
          onChange={(e) => onChange({ field_type: e.target.value as VacancyFieldType })}
        >
          {EDITABLE_FIELD_TYPES.map((t) => (
            <option key={t} value={t}>
              {FIELD_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <div className={styles.fieldRowCtl}>
          <button type="button" className={`${primitives.btnIcon} ${primitives.btnIconXs}`} onClick={onMoveUp} disabled={!canMoveUp} aria-label="Переместить вверх">
            <span style={{ display: "inline-flex", transform: "rotate(-90deg)" }}>
              <Icon name="chevron" size={12} />
            </span>
          </button>
          <button type="button" className={`${primitives.btnIcon} ${primitives.btnIconXs}`} onClick={onMoveDown} disabled={!canMoveDown} aria-label="Переместить вниз">
            <span style={{ display: "inline-flex", transform: "rotate(90deg)" }}>
              <Icon name="chevron" size={12} />
            </span>
          </button>
          <button type="button" className={`${primitives.btnIcon} ${primitives.btnIconXs}`} onClick={onRemove} aria-label="Удалить поле">
            <Icon name="x" size={12} />
          </button>
        </div>
      </div>

      {field.field_type === "rich_text" && (
        <div className={styles.markdownToolbar}>
          <button type="button" onClick={() => applyMarkup((v, s, e) => wrapSelection(v, s, e, "**"))}>
            <strong>Ж</strong>
          </button>
          <button type="button" onClick={() => applyMarkup((v, s, e) => wrapSelection(v, s, e, "*"))}>
            <em>К</em>
          </button>
          <button type="button" onClick={() => applyMarkup(toggleBulletLines)}>
            Список
          </button>
          <button
            type="button"
            onClick={() => {
              const url = window.prompt("Ссылка (https://…)");
              if (url) applyMarkup((v, s, e) => insertLink(v, s, e, url));
            }}
          >
            Ссылка
          </button>
        </div>
      )}

      {field.field_type === "checkbox" ? (
        <label className={primitives.checkLabel}>
          <input type="checkbox" checked={field.value === "true"} onChange={(e) => onChange({ value: e.target.checked ? "true" : "false" })} />
          Да
        </label>
      ) : field.field_type === "rich_text" || field.field_type === "textarea" ? (
        <textarea ref={textareaRef} rows={4} value={field.value} onChange={(e) => onChange({ value: e.target.value })} />
      ) : (
        <input
          type={field.field_type === "number" ? "number" : field.field_type === "date" ? "date" : "text"}
          value={field.value}
          onChange={(e) => onChange({ value: e.target.value })}
        />
      )}

      {field.field_type === "rich_text" && field.value.trim() !== "" && (
        <div className={styles.fieldPreview}>
          <span className={styles.fieldPreviewLabel}>Предпросмотр</span>
          <FieldValueView fieldType="rich_text" value={field.value} />
        </div>
      )}
    </div>
  );
}
