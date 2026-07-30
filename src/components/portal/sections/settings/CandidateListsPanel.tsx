"use client";

import { useState } from "react";
import { usePortal } from "@/components/portal/context/PortalContext";
import { Button } from "@/components/portal/ui/Button";
import { Icon } from "@/components/portal/ui/Icon";
import { Panel, PanelBody, PanelHead } from "@/components/portal/ui/Panel";
import { CANDIDATE_LIST_TYPES, LIST_TYPE_LABELS } from "@/lib/portal/candidateOptions";
import type { CandidateListOption, CandidateListType } from "@/lib/supabase/candidateListOptions.types";
import primitives from "@/components/portal/ui/primitives.module.css";
import styles from "./SettingsSection.module.css";

/** Редактируемые справочники подсказок для полей кандидата. Значения не удаляются, только деактивируются. */
export function CandidateListsPanel() {
  const {
    listOptions,
    listOptionsLoading,
    listOptionsError,
    refreshListOptions,
    addListOption,
    renameListOption,
    setListOptionActive,
    reorderListOption,
  } = usePortal();

  const [activeType, setActiveType] = useState<CandidateListType>("recruiter");
  const [newValue, setNewValue] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const rows = listOptions.filter((o) => o.list_type === activeType).sort((a, b) => a.sort_order - b.sort_order);

  async function handleAdd() {
    const value = newValue.trim();
    if (!value) return;
    setAdding(true);
    const ok = await addListOption(activeType, value);
    setAdding(false);
    if (ok) setNewValue("");
  }

  function startEdit(o: CandidateListOption) {
    setEditingId(o.id);
    setEditValue(o.value);
  }

  async function commitEdit() {
    const id = editingId;
    const value = editValue.trim();
    setEditingId(null);
    if (!id || !value) return;
    await renameListOption(id, value);
  }

  return (
    <Panel>
      <PanelHead>
        <h3>Списки для кандидатов</h3>
      </PanelHead>
      <PanelBody>
        <div className={primitives.seg} style={{ marginBottom: 14 }}>
          {CANDIDATE_LIST_TYPES.map((t) => (
            <button
              key={t}
              className={`${primitives.segButton} ${activeType === t ? primitives.segButtonActive : ""}`}
              onClick={() => {
                setActiveType(t);
                setEditingId(null);
              }}
            >
              {LIST_TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        {listOptionsLoading && <p className={styles.fieldNote}>Загрузка…</p>}
        {!listOptionsLoading && listOptionsError && (
          <p className={styles.fieldError}>
            Не удалось загрузить списки.{" "}
            <button
              onClick={refreshListOptions}
              style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
            >
              Повторить
            </button>
          </p>
        )}
        {!listOptionsLoading &&
          !listOptionsError &&
          (rows.length === 0 ? (
            <p className={styles.fieldNote}>Список пуст.</p>
          ) : (
            rows.map((o, i) => (
              <div className={styles.settingsRow} key={o.id}>
                <div className={styles.reorderCtl}>
                  <button
                    className={`${primitives.btnIcon} ${primitives.btnIconXs}`}
                    onClick={() => reorderListOption(o.id, "up")}
                    disabled={i === 0}
                    aria-label="Переместить вверх"
                  >
                    <span style={{ display: "inline-flex", transform: "rotate(-90deg)" }}>
                      <Icon name="chevron" size={14} />
                    </span>
                  </button>
                  <button
                    className={`${primitives.btnIcon} ${primitives.btnIconXs}`}
                    onClick={() => reorderListOption(o.id, "down")}
                    disabled={i === rows.length - 1}
                    aria-label="Переместить вниз"
                  >
                    <span style={{ display: "inline-flex", transform: "rotate(90deg)" }}>
                      <Icon name="chevron" size={14} />
                    </span>
                  </button>
                </div>
                {editingId === o.id ? (
                  <input
                    autoFocus
                    className={styles.listValueInput}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEdit();
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    onBlur={commitEdit}
                  />
                ) : (
                  <button
                    className={`${styles.listValueText} ${o.is_active ? "" : styles.listValueInactive}`}
                    onClick={() => startEdit(o)}
                  >
                    {o.value}
                    {!o.is_active && <span className={styles.inactiveTag}>неактивно</span>}
                  </button>
                )}
                <div className={styles.ctl}>
                  <button
                    className={`${primitives.toggle} ${o.is_active ? primitives.toggleOn : ""}`}
                    onClick={() => setListOptionActive(o.id, !o.is_active)}
                    aria-label={o.is_active ? "Деактивировать" : "Активировать"}
                    title={o.is_active ? "Активно — виден в списках" : "Неактивно — скрыт из списков"}
                  />
                </div>
              </div>
            ))
          ))}

        <div className={styles.addRow}>
          <input
            type="text"
            placeholder={`Добавить в «${LIST_TYPE_LABELS[activeType]}»…`}
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
            }}
          />
          <Button size="sm" onClick={handleAdd} disabled={adding || !newValue.trim()}>
            <Icon name="plus" size={14} />
            Добавить
          </Button>
        </div>
      </PanelBody>
    </Panel>
  );
}
