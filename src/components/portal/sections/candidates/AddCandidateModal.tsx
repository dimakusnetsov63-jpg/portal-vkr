"use client";

import { useState } from "react";
import { usePortal } from "@/components/portal/context/PortalContext";
import { Button } from "@/components/portal/ui/Button";
import { Combobox } from "@/components/portal/ui/Combobox";
import { Modal } from "@/components/portal/ui/Modal";
import { activeListOptions, CANDIDATE_PROJECTS } from "@/lib/portal/candidateOptions";
import type { CandidateInsert, CandidateProject } from "@/lib/supabase/candidates.types";
import primitives from "@/components/portal/ui/primitives.module.css";

export function AddCandidateModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (input: CandidateInsert) => Promise<boolean>;
}) {
  const { pushToast, listOptions } = usePortal();
  const [fullName, setFullName] = useState("");
  const [project, setProject] = useState<CandidateProject>(CANDIDATE_PROJECTS[0]);
  const [city, setCity] = useState("");
  const [recruiter, setRecruiter] = useState("");
  const [saving, setSaving] = useState(false);

  const cityOptions = activeListOptions(listOptions, "city").map((o) => o.value);
  const recruiterOptions = activeListOptions(listOptions, "recruiter").map((o) => o.value);

  async function handleSave() {
    if (!fullName.trim()) {
      pushToast("Укажите ФИО кандидата", "error");
      return;
    }
    setSaving(true);
    const ok = await onSubmit({
      full_name: fullName.trim(),
      project,
      city: city.trim() || null,
      recruiter: recruiter.trim() || null,
    });
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Добавить кандидата"
      footer={
        <>
          <Button onClick={onClose}>Отмена</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? "Сохранение…" : "Добавить"}
          </Button>
        </>
      }
    >
      <div className={primitives.field}>
        <label>ФИО</label>
        <input
          type="text"
          placeholder="Иванов Иван Иванович"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
      </div>
      <div className={primitives.fieldRow}>
        <div className={primitives.field}>
          <label>Проект</label>
          <select value={project} onChange={(e) => setProject(e.target.value as CandidateProject)}>
            {CANDIDATE_PROJECTS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className={primitives.field}>
          <label>Город</label>
          <Combobox value={city} onChange={setCity} options={cityOptions} />
        </div>
      </div>
      <div className={primitives.field}>
        <label>Рекрутер</label>
        <Combobox value={recruiter} onChange={setRecruiter} options={recruiterOptions} />
      </div>
      <p style={{ fontSize: 12, color: "var(--text-3)" }}>
        Остальные поля (телефон, стадия, медкнижка, даты и т.д.) можно заполнить после создания — откройте карточку
        кандидата.
      </p>
    </Modal>
  );
}
