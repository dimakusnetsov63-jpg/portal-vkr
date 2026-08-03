"use client";

import { useState } from "react";
import { usePortal } from "@/components/portal/context/PortalContext";
import { Button } from "@/components/portal/ui/Button";
import { Combobox } from "@/components/portal/ui/Combobox";
import { Modal } from "@/components/portal/ui/Modal";
import modal from "@/components/portal/ui/Modal.module.css";
import { activeListOptions } from "@/lib/portal/candidateOptions";
import { visibleProjectOptions } from "@/lib/auth/projectAccess";
import type { RateUnit } from "@/lib/supabase/rates.types";
import primitives from "@/components/portal/ui/primitives.module.css";
import { RATE_UNITS, UNIT_LABELS } from "./rateOptions";

/**
 * Creation modal captures only "Основные данные" (проект/город/юр. лицо/
 * должность/ставка за час) — same convention as AddAddressModal: остальные
 * тарифные поля, условия блока и дополнительные показатели заполняются
 * потом в карточке (RateDrawer), а не в этой форме.
 */
export function AddRateModal({ onClose }: { onClose: () => void }) {
  const { pushToast, listOptions, addRate, currentUser } = usePortal();
  const [project, setProject] = useState("");
  const [city, setCity] = useState("");
  const [legalEntity, setLegalEntity] = useState("");
  const [position, setPosition] = useState("");
  const [unit, setUnit] = useState<RateUnit>("hour");
  const [rateHour, setRateHour] = useState("");
  const [saving, setSaving] = useState(false);

  const projectOptions = visibleProjectOptions(
    currentUser.role,
    currentUser.projects,
    activeListOptions(listOptions, "project").map((o) => o.value),
  );
  const cityOptions = activeListOptions(listOptions, "city").map((o) => o.value);
  const legalEntityOptions = activeListOptions(listOptions, "legal_entity").map((o) => o.value);
  const positionOptions = activeListOptions(listOptions, "position").map((o) => o.value);

  async function handleSave() {
    if (!project.trim() || !city.trim() || !position.trim()) {
      pushToast("Укажите проект, город и должность", "error");
      return;
    }
    setSaving(true);
    const parsedRateHour = rateHour.trim() ? Number(rateHour) : null;
    const ok = await addRate({
      project: project.trim(),
      city: city.trim(),
      legalEntity: legalEntity.trim(),
      rate: {
        position: position.trim(),
        unit,
        rate_hour: Number.isFinite(parsedRateHour) ? parsedRateHour : null,
      },
    });
    setSaving(false);
    if (ok) {
      onClose();
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Добавить ставку"
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
      <div className={primitives.fieldRow}>
        <div className={primitives.field}>
          <label>Юр. лицо</label>
          <Combobox value={legalEntity} onChange={setLegalEntity} options={legalEntityOptions} />
        </div>
        <div className={primitives.field}>
          <label>Должность</label>
          <Combobox value={position} onChange={setPosition} options={positionOptions} />
        </div>
      </div>
      <div className={primitives.fieldRow}>
        <div className={primitives.field}>
          <label>Единица измерения</label>
          <select value={unit} onChange={(e) => setUnit(e.target.value as RateUnit)}>
            {RATE_UNITS.map((u) => (
              <option key={u} value={u}>
                {UNIT_LABELS[u]}
              </option>
            ))}
          </select>
        </div>
        <div className={primitives.field}>
          <label>Ставка за час</label>
          <input type="number" min={0} value={rateHour} onChange={(e) => setRateHour(e.target.value)} placeholder="235" />
        </div>
      </div>
      <p className={modal.modalNote}>
        Остальные тарифные показатели, условия проекта в городе и дополнительные показатели можно заполнить после
        создания — откройте карточку ставки.
      </p>
    </Modal>
  );
}
