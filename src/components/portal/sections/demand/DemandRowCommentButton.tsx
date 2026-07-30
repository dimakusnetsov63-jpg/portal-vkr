"use client";

import { useState } from "react";
import { usePortal } from "@/components/portal/context/PortalContext";
import { Button } from "@/components/portal/ui/Button";
import { Icon } from "@/components/portal/ui/Icon";
import { Modal } from "@/components/portal/ui/Modal";
import { DEMAND_COMMENT_MAX_LENGTH, isCommentTooLong, normalizeComment } from "./demandRowMeta";
import styles from "./DemandSection.module.css";

/** Comment indicator + editor popover for a project+city row. Saves only on explicit action (button or Ctrl/Cmd+Enter) — never on every keystroke, and Escape/Cancel discard the draft without saving. */
export function DemandRowCommentButton({
  project,
  city,
  position,
  comment,
}: {
  project: string;
  city: string;
  position: string;
  comment: string | null;
}) {
  const { updateDemandRowMeta, pushToast } = usePortal();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(comment ?? "");
  const [saving, setSaving] = useState(false);

  function openModal() {
    setDraft(comment ?? "");
    setOpen(true);
  }

  async function handleSave() {
    if (isCommentTooLong(draft)) {
      pushToast("Комментарий не может быть длиннее 2000 символов", "error");
      return;
    }
    if (saving) return;
    setSaving(true);
    const ok = await updateDemandRowMeta(project, city, position, { comment: normalizeComment(draft) });
    setSaving(false);
    if (ok) setOpen(false);
  }

  async function handleDelete() {
    if (saving) return;
    setSaving(true);
    const ok = await updateDemandRowMeta(project, city, position, { comment: null });
    setSaving(false);
    if (ok) setOpen(false);
  }

  const trimmedLength = draft.trim().length;

  return (
    <>
      <button
        type="button"
        className={`${styles.rowCommentTrigger} ${comment ? styles.rowCommentTriggerActive : ""}`}
        title={comment ?? "Добавить комментарий"}
        aria-label="Комментарий к строке"
        onClick={(e) => {
          e.stopPropagation();
          openModal();
        }}
      >
        <Icon name="message" size={14} />
      </button>

      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title={`Комментарий — ${project}, ${city}, ${position}`}
          footer={
            <>
              {comment && (
                <Button danger onClick={handleDelete} disabled={saving}>
                  Удалить комментарий
                </Button>
              )}
              <div className={styles.modalFootSpacer} />
              <Button onClick={() => setOpen(false)} disabled={saving}>
                Отмена
              </Button>
              <Button variant="primary" onClick={handleSave} disabled={saving}>
                {saving ? "Сохранение…" : "Сохранить"}
              </Button>
            </>
          }
        >
          <textarea
            className={styles.rowCommentTextarea}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                handleSave();
              }
            }}
            placeholder="Например: город временно не принимает новых сотрудников"
            rows={5}
            autoFocus
          />
          <div className={styles.rowCommentCounter}>
            {trimmedLength} / {DEMAND_COMMENT_MAX_LENGTH}
          </div>
        </Modal>
      )}
    </>
  );
}
