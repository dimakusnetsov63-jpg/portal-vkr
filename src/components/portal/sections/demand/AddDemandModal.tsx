"use client";

import { useState } from "react";
import { usePortal } from "@/components/portal/context/PortalContext";
import { Button } from "@/components/portal/ui/Button";
import { Combobox } from "@/components/portal/ui/Combobox";
import { Icon } from "@/components/portal/ui/Icon";
import { Modal } from "@/components/portal/ui/Modal";
import { activeListOptions, CANDIDATE_PROJECTS } from "@/lib/portal/candidateOptions";
import { enumerateIsoDates, toIsoDate } from "@/lib/portal/demandWindow";
import type { CandidateProject } from "@/lib/supabase/candidates.types";
import primitives from "@/components/portal/ui/primitives.module.css";
import styles from "./DemandSection.module.css";

/** "1 значение" / "2 значения" / "5 значений" — Russian plural forms for a count. */
function pluralizeValues(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return "значений";
  if (mod10 === 1) return "значение";
  if (mod10 >= 2 && mod10 <= 4) return "значения";
  return "значений";
}

export function AddDemandModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (input: {
    project: string;
    cities: string[];
    fromDate: string;
    toDate: string;
    plannedCount: number;
  }) => Promise<boolean>;
}) {
  const { pushToast, listOptions } = usePortal();
  const [project, setProject] = useState<CandidateProject>(CANDIDATE_PROJECTS[0]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [cityInput, setCityInput] = useState("");
  const today = toIsoDate(new Date());
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [plannedCount, setPlannedCount] = useState(5);
  const [saving, setSaving] = useState(false);

  const cityOptions = activeListOptions(listOptions, "city")
    .map((o) => o.value)
    .filter((c) => !selectedCities.includes(c));

  function addCity(value: string) {
    const v = value.trim();
    if (v && !selectedCities.includes(v)) setSelectedCities((prev) => [...prev, v]);
    setCityInput("");
  }

  function removeCity(value: string) {
    setSelectedCities((prev) => prev.filter((c) => c !== value));
  }

  const validRange = Boolean(fromDate && toDate && fromDate <= toDate);
  const dayCount = validRange ? enumerateIsoDates(fromDate, toDate).length : 0;
  const totalCount = dayCount * selectedCities.length;

  async function handleSave() {
    if (selectedCities.length === 0) {
      pushToast("Выберите хотя бы один город", "error");
      return;
    }
    if (!validRange) {
      pushToast("Дата начала должна быть не позже даты окончания", "error");
      return;
    }
    if (!Number.isInteger(plannedCount) || plannedCount < 0) {
      pushToast("Количество должно быть целым числом от 0", "error");
      return;
    }
    setSaving(true);
    const ok = await onSubmit({ project, cities: selectedCities, fromDate, toDate, plannedCount });
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Добавить потребность"
      footer={
        <>
          <Button onClick={onClose}>Отмена</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving || selectedCities.length === 0}>
            {saving ? "Сохранение…" : "Сохранить"}
          </Button>
        </>
      }
    >
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
        <label>Города</label>
        {selectedCities.length > 0 && (
          <div className={styles.cityTagRow}>
            {selectedCities.map((c) => (
              <span key={c} className={styles.cityTag}>
                {c}
                <button type="button" onClick={() => removeCity(c)} aria-label={`Убрать ${c}`}>
                  <Icon name="x" size={11} />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className={styles.cityInputRow}>
          <Combobox
            value={cityInput}
            onChange={(v) => (cityOptions.includes(v) ? addCity(v) : setCityInput(v))}
            options={cityOptions}
            placeholder="Добавить город"
          />
          <Button size="sm" onClick={() => addCity(cityInput)} disabled={!cityInput.trim()}>
            <Icon name="plus" size={13} />
          </Button>
        </div>
      </div>

      <div className={primitives.fieldRow}>
        <div className={primitives.field}>
          <label>Дата начала</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </div>
        <div className={primitives.field}>
          <label>Дата окончания</label>
          <input type="date" value={toDate} min={fromDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
      </div>

      <div className={primitives.field}>
        <label>Количество сотрудников (на каждый день и город)</label>
        <input
          type="number"
          min={0}
          value={plannedCount}
          onChange={(e) => setPlannedCount(parseInt(e.target.value || "0", 10))}
        />
      </div>

      {totalCount > 0 && (
        <p className={styles.bulkNotice}>
          Будет создано или обновлено <strong>{totalCount}</strong> {pluralizeValues(totalCount)} потребности.
        </p>
      )}
    </Modal>
  );
}
