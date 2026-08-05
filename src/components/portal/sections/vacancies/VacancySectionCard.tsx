"use client";

import { AccordionItem } from "@/components/portal/ui/Accordion";
import { Icon, type IconName } from "@/components/portal/ui/Icon";
import primitives from "@/components/portal/ui/primitives.module.css";
import type { VacancyAttachmentDraft, VacancyFieldDraft, VacancySectionDraft } from "@/lib/supabase/vacancyProjects.types";
import { VacancyAttachmentsList } from "./VacancyAttachmentsList";
import { VacancyFieldEditor } from "./VacancyFieldEditor";
import styles from "./VacancyDetail.module.css";

/**
 * Одна карточка раздела вакансии. Системный раздел («Общая информация») —
 * всегда первый, всегда развёрнут, без сворачивания/архивации/
 * переупорядочивания: рендерится простой шапкой без кнопки-переключателя,
 * а не через Accordion. Остальные разделы — обычный AccordionItem.
 */
export function VacancySectionCard({
  section,
  editing,
  open,
  onToggleOpen,
  highlightQuery,
  onTitleChange,
  onArchive,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  onFieldChange,
  onFieldRemove,
  onFieldMoveUp,
  onFieldMoveDown,
  onAddField,
  onAttachmentAdd,
  onAttachmentRemove,
}: {
  section: VacancySectionDraft;
  editing: boolean;
  open: boolean;
  onToggleOpen: (open: boolean) => void;
  highlightQuery: string;
  onTitleChange: (title: string) => void;
  onArchive: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onFieldChange: (fieldIndex: number, patch: Partial<VacancyFieldDraft>) => void;
  onFieldRemove: (fieldIndex: number) => void;
  onFieldMoveUp: (fieldIndex: number) => void;
  onFieldMoveDown: (fieldIndex: number) => void;
  onAddField: () => void;
  onAttachmentAdd: (attachment: Omit<VacancyAttachmentDraft, "id" | "sort_order">) => void;
  onAttachmentRemove: (index: number) => void;
}) {
  const body = (
    <>
      {section.fields.map((field, i) => (
        <VacancyFieldEditor
          key={i}
          field={field}
          editing={editing}
          highlightQuery={highlightQuery}
          onChange={(patch) => onFieldChange(i, patch)}
          onRemove={() => onFieldRemove(i)}
          onMoveUp={() => onFieldMoveUp(i)}
          onMoveDown={() => onFieldMoveDown(i)}
          canMoveUp={i > 0}
          canMoveDown={i < section.fields.length - 1}
        />
      ))}
      {editing && (
        <button type="button" className={styles.addFieldButton} onClick={onAddField}>
          <Icon name="plus" size={14} />
          Добавить поле
        </button>
      )}
      <VacancyAttachmentsList attachments={section.attachments} editing={editing} onAdd={onAttachmentAdd} onRemove={onAttachmentRemove} />
    </>
  );

  if (section.is_system) {
    return (
      <div className={styles.systemSection}>
        <div className={styles.systemSectionHead}>
          {section.icon && (
            <span className={styles.systemSectionIcon}>
              <Icon name={section.icon as IconName} size={16} />
            </span>
          )}
          <span className={styles.systemSectionTitle}>{section.title}</span>
        </div>
        <div className={styles.systemSectionBody}>{body}</div>
      </div>
    );
  }

  const headerExtra = editing ? (
    <div className={styles.sectionCtl}>
      <button type="button" className={`${primitives.btnIcon} ${primitives.btnIconXs}`} onClick={onMoveUp} disabled={!canMoveUp} aria-label="Переместить раздел вверх">
        <span style={{ display: "inline-flex", transform: "rotate(-90deg)" }}>
          <Icon name="chevron" size={12} />
        </span>
      </button>
      <button type="button" className={`${primitives.btnIcon} ${primitives.btnIconXs}`} onClick={onMoveDown} disabled={!canMoveDown} aria-label="Переместить раздел вниз">
        <span style={{ display: "inline-flex", transform: "rotate(90deg)" }}>
          <Icon name="chevron" size={12} />
        </span>
      </button>
      <button type="button" className={`${primitives.btnIcon} ${primitives.btnIconXs}`} onClick={onArchive} aria-label="Архивировать раздел" title="Архивировать раздел">
        <Icon name="alert" size={12} />
      </button>
    </div>
  ) : undefined;

  return (
    <AccordionItem
      id={`vacancy-section-${section.id ?? section.title}`}
      title={
        editing ? (
          <input
            className={styles.sectionTitleInput}
            type="text"
            value={section.title}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onTitleChange(e.target.value)}
          />
        ) : (
          section.title
        )
      }
      icon={section.icon ? <Icon name={section.icon as IconName} size={16} /> : undefined}
      open={open}
      onToggle={onToggleOpen}
      headerExtra={headerExtra}
    >
      {body}
    </AccordionItem>
  );
}
