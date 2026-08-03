"use client";

import { useState } from "react";
import { usePortal } from "@/components/portal/context/PortalContext";
import { Button } from "@/components/portal/ui/Button";
import { Combobox } from "@/components/portal/ui/Combobox";
import { Modal } from "@/components/portal/ui/Modal";
import modal from "@/components/portal/ui/Modal.module.css";
import { activeListOptions } from "@/lib/portal/candidateOptions";
import { visibleProjectOptions } from "@/lib/auth/projectAccess";
import type { CandidateInsert } from "@/lib/supabase/candidates.types";
import primitives from "@/components/portal/ui/primitives.module.css";

export function AddCandidateModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (input: CandidateInsert) => Promise<boolean>;
}) {
  const { pushToast, listOptions, currentUser } = usePortal();
  const [fullName, setFullName] = useState("");
  const [project, setProject] = useState("");
  const [city, setCity] = useState("");
  const [position, setPosition] = useState("");
  const [recruiter, setRecruiter] = useState("");
  const [saving, setSaving] = useState(false);

  const projectOptions = visibleProjectOptions(
    currentUser.role,
    currentUser.projects,
    activeListOptions(listOptions, "project").map((o) => o.value),
  );
  const cityOptions = activeListOptions(listOptions, "city").map((o) => o.value);
  const positionOptions = activeListOptions(listOptions, "position").map((o) => o.value);
  const recruiterOptions = activeListOptions(listOptions, "recruiter").map((o) => o.value);

  async function handleSave() {
    if (!fullName.trim()) {
      pushToast("Укажите ФИО кандидата", "error");
      return;
    }
    if (!project.trim()) {
      pushToast("Укажите проект", "error");
      return;
    }
    setSaving(true);
    const ok = await onSubmit({
      full_name: fullName.trim(),
      project: project.trim(),
      city: city.trim() || null,
      position: position.trim() || null,
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
          <Combobox value={project} onChange={setProject} options={projectOptions} />
        </div>
        <div className={primitives.field}>
          <label>Город</label>
          <Combobox value={city} onChange={setCity} options={cityOptions} />
        </div>
      </div>
      <div className={primitives.fieldRow}>
        <div className={primitives.field}>
          <label>Должность</label>
          <Combobox value={position} onChange={setPosition} options={positionOptions} />
        </div>
        <div className={primitives.field}>
          <label>Рекрутер</label>
          <Combobox value={recruiter} onChange={setRecruiter} options={recruiterOptions} />
        </div>
      </div>
      <p className={modal.modalNote}>
        Остальные поля (телефон, стадия, медкнижка, даты и т.д.) можно заполнить после создания — откройте карточку
        кандидата.
      </p>
    </Modal>
  );
}
