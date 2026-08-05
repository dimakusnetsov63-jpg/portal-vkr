"use client";

import { useState } from "react";
import { usePortal } from "@/components/portal/context/PortalContext";
import { Button } from "@/components/portal/ui/Button";
import { Icon } from "@/components/portal/ui/Icon";
import primitives from "@/components/portal/ui/primitives.module.css";
import { isSafeDocumentUrl } from "@/components/portal/sections/addresses/addressDocumentLinks";
import type { VacancyAttachmentDraft, VacancyAttachmentType } from "@/lib/supabase/vacancyProjects.types";
import styles from "./VacancyDetail.module.css";

const TYPE_LABELS: Record<VacancyAttachmentType, string> = {
  pdf: "PDF",
  google_doc: "Google Docs",
  video: "Видео",
  link: "Ссылка",
};

const TYPE_ICON: Record<VacancyAttachmentType, "file" | "briefcase"> = {
  pdf: "file",
  google_doc: "file",
  video: "briefcase",
  link: "briefcase",
};

/** Список вложений — общий компонент и для блока «Вложения» вакансии (section=null), и для вложений внутри карточки раздела. */
export function VacancyAttachmentsList({
  attachments,
  editing,
  onAdd,
  onRemove,
}: {
  attachments: VacancyAttachmentDraft[];
  editing: boolean;
  onAdd: (attachment: Omit<VacancyAttachmentDraft, "id" | "sort_order">) => void;
  onRemove: (index: number) => void;
}) {
  const { pushToast } = usePortal();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState<VacancyAttachmentType>("link");

  if (attachments.length === 0 && !editing) return null;

  function handleAdd() {
    if (!title.trim() || !isSafeDocumentUrl(url)) {
      pushToast("Укажите название и корректную ссылку (http/https)", "error");
      return;
    }
    onAdd({ title: title.trim(), url: url.trim(), type });
    setTitle("");
    setUrl("");
    setType("link");
  }

  return (
    <div className={styles.attachments}>
      {attachments.length > 0 && (
        <ul className={styles.attachmentList}>
          {attachments.map((a, i) => (
            <li key={i}>
              {isSafeDocumentUrl(a.url) ? (
                <a href={a.url} target="_blank" rel="noopener noreferrer">
                  <Icon name={TYPE_ICON[a.type]} size={14} />
                  {a.title}
                </a>
              ) : (
                <span title="Небезопасная ссылка">
                  <Icon name="alert" size={14} />
                  {a.title}
                </span>
              )}
              <span className={styles.attachmentType}>{TYPE_LABELS[a.type]}</span>
              {editing && (
                <button
                  type="button"
                  className={`${primitives.btnIcon} ${primitives.btnIconXs}`}
                  onClick={() => onRemove(i)}
                  aria-label="Удалить вложение"
                >
                  <Icon name="x" size={12} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <div className={styles.attachmentAddRow}>
          <input type="text" placeholder="Название" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input type="text" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
          <select value={type} onChange={(e) => setType(e.target.value as VacancyAttachmentType)}>
            {(Object.keys(TYPE_LABELS) as VacancyAttachmentType[]).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={handleAdd}>
            <Icon name="plus" size={14} />
          </Button>
        </div>
      )}
    </div>
  );
}
