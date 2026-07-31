"use client";

import { useState } from "react";
import { usePortal } from "@/components/portal/context/PortalContext";
import { Button } from "@/components/portal/ui/Button";
import { Combobox } from "@/components/portal/ui/Combobox";
import { Modal } from "@/components/portal/ui/Modal";
import modal from "@/components/portal/ui/Modal.module.css";
import { activeListOptions } from "@/lib/portal/candidateOptions";
import type { AddressInsert, AddressObjectType } from "@/lib/supabase/addresses.types";
import primitives from "@/components/portal/ui/primitives.module.css";
import { OBJECT_TYPE_LABELS, OBJECT_TYPES } from "./addressOptions";

/**
 * Creation modal captures only "Основные данные" (project/city/address are
 * required per ТЗ; metro/district/object type/specialization are quick
 * extras) — same convention as AddCandidateModal: потребность, графики,
 * оплата, контакты, комментарии, особенности, приоритет и документы
 * заполняются потом в карточке (AddressDrawer), а не в этой форме.
 */
export function AddAddressModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (input: AddressInsert) => Promise<boolean>;
}) {
  const { pushToast, listOptions } = usePortal();
  const [project, setProject] = useState("");
  const [city, setCity] = useState("");
  const [fullAddress, setFullAddress] = useState("");
  const [metro, setMetro] = useState("");
  const [district, setDistrict] = useState("");
  const [objectType, setObjectType] = useState<AddressObjectType>("other");
  const [position, setPosition] = useState("");
  const [saving, setSaving] = useState(false);

  const projectOptions = activeListOptions(listOptions, "project").map((o) => o.value);
  const cityOptions = activeListOptions(listOptions, "city").map((o) => o.value);
  const positionOptions = activeListOptions(listOptions, "position").map((o) => o.value);

  async function handleSave() {
    if (!project.trim() || !city.trim() || !fullAddress.trim()) {
      pushToast("Укажите проект, город и полный адрес", "error");
      return;
    }
    setSaving(true);
    const ok = await onSubmit({
      project: project.trim(),
      city: city.trim(),
      full_address: fullAddress.trim(),
      metro: metro.trim() || null,
      district: district.trim() || null,
      object_type: objectType,
      position: position.trim() || null,
    });
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Добавить адрес"
      footer={
        <>
          <Button onClick={onClose}>Отмена</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? "Сохранение…" : "Добавить"}
          </Button>
        </>
      }
    >
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
      <div className={primitives.field}>
        <label>Полный адрес</label>
        <input
          type="text"
          placeholder="ул. Ленина, 25"
          value={fullAddress}
          onChange={(e) => setFullAddress(e.target.value)}
        />
      </div>
      <div className={primitives.fieldRow}>
        <div className={primitives.field}>
          <label>Метро</label>
          <input type="text" value={metro} onChange={(e) => setMetro(e.target.value)} />
        </div>
        <div className={primitives.field}>
          <label>Район</label>
          <input type="text" value={district} onChange={(e) => setDistrict(e.target.value)} />
        </div>
      </div>
      <div className={primitives.fieldRow}>
        <div className={primitives.field}>
          <label>Тип объекта</label>
          <select value={objectType} onChange={(e) => setObjectType(e.target.value as AddressObjectType)}>
            {OBJECT_TYPES.map((t) => (
              <option key={t} value={t}>
                {OBJECT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div className={primitives.field}>
          <label>Специализация</label>
          <Combobox value={position} onChange={setPosition} options={positionOptions} />
        </div>
      </div>
      <p className={modal.modalNote}>
        Координаты, потребность, графики, оплата, контакты, комментарий, особенности, приоритет и документы можно
        заполнить после создания — откройте карточку адреса.
      </p>
    </Modal>
  );
}
