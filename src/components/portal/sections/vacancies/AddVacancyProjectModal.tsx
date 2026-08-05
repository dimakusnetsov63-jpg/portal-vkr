"use client";

import { useState } from "react";
import { usePortal } from "@/components/portal/context/PortalContext";
import { Button } from "@/components/portal/ui/Button";
import { Modal } from "@/components/portal/ui/Modal";
import modal from "@/components/portal/ui/Modal.module.css";
import { activeListOptions } from "@/lib/portal/candidateOptions";
import primitives from "@/components/portal/ui/primitives.module.css";

/**
 * Быстрое создание — только название и категория (по образцу
 * AddAddressModal). Всё остальное (разделы, поля, вложения) заполняется
 * потом в панели вакансии: сразу после создания заводится системный раздел
 * «Общая информация» с полями-затравками (см. vacancyOptions.ts).
 */
export function AddVacancyProjectModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (input: { title: string; categoryOptionId: string | null }) => Promise<boolean>;
}) {
  const { pushToast, listOptions } = usePortal();
  const [title, setTitle] = useState("");
  const [categoryOptionId, setCategoryOptionId] = useState("");
  const [saving, setSaving] = useState(false);

  const categoryOptions = activeListOptions(listOptions, "vacancy_category");

  async function handleSave() {
    if (!title.trim()) {
      pushToast("Укажите название вакансии", "error");
      return;
    }
    setSaving(true);
    const ok = await onSubmit({ title: title.trim(), categoryOptionId: categoryOptionId || null });
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Добавить вакансию"
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
        <label>Название вакансии</label>
        <input
          type="text"
          placeholder="Например, Сборщик заказов — Самокат"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />
      </div>
      <div className={primitives.field}>
        <label>Категория</label>
        <select value={categoryOptionId} onChange={(e) => setCategoryOptionId(e.target.value)}>
          <option value="">Не указана</option>
          {categoryOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.value}
            </option>
          ))}
        </select>
      </div>
      <p className={modal.modalNote}>
        График, обязанности, требования, оплата и остальные разделы заполняются после создания — откройте карточку
        вакансии.
      </p>
    </Modal>
  );
}
