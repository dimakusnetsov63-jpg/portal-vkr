"use client";

import { useState } from "react";
import { usePortal } from "@/components/portal/context/PortalContext";
import { Button } from "@/components/portal/ui/Button";
import { Combobox } from "@/components/portal/ui/Combobox";
import { Icon } from "@/components/portal/ui/Icon";
import { Modal } from "@/components/portal/ui/Modal";
import { activeListOptions } from "@/lib/portal/candidateOptions";
import { visibleProjectOptions } from "@/lib/auth/projectAccess";
import { enumerateIsoDates, toIsoDate } from "@/lib/portal/demandWindow";
import { isLargeBulkCount } from "./demandAggregate";
import {
  DEMAND_COMMENT_MAX_LENGTH,
  DEMAND_ROW_STATUSES,
  DEMAND_ROW_STATUS_LABELS,
  isCommentTooLong,
  normalizeComment,
  type DemandRowStatus,
} from "./demandRowMeta";
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
    positions: string[];
    fromDate: string;
    toDate: string;
    plannedCount: number;
  }) => Promise<boolean>;
}) {
  const { pushToast, listOptions, updateDemandRowMeta, currentUser } = usePortal();
  const [project, setProject] = useState("");
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [cityInput, setCityInput] = useState("");
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [positionInput, setPositionInput] = useState("");
  const today = toIsoDate(new Date());
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [plannedCount, setPlannedCount] = useState(5);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<DemandRowStatus>("active");
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const projectOptions = visibleProjectOptions(
    currentUser.role,
    currentUser.projects,
    activeListOptions(listOptions, "project").map((o) => o.value),
  );
  const cityOptions = activeListOptions(listOptions, "city")
    .map((o) => o.value)
    .filter((c) => !selectedCities.includes(c));
  const positionOptions = activeListOptions(listOptions, "position")
    .map((o) => o.value)
    .filter((p) => !selectedPositions.includes(p));

  function addCity(value: string) {
    const v = value.trim();
    if (v && !selectedCities.includes(v)) setSelectedCities((prev) => [...prev, v]);
    setCityInput("");
  }

  function removeCity(value: string) {
    setSelectedCities((prev) => prev.filter((c) => c !== value));
  }

  function addPosition(value: string) {
    const v = value.trim();
    if (v && !selectedPositions.includes(v)) setSelectedPositions((prev) => [...prev, v]);
    setPositionInput("");
  }

  function removePosition(value: string) {
    setSelectedPositions((prev) => prev.filter((p) => p !== value));
  }

  const validRange = Boolean(fromDate && toDate && fromDate <= toDate);
  const dayCount = validRange ? enumerateIsoDates(fromDate, toDate).length : 0;
  const totalCount = dayCount * selectedCities.length * selectedPositions.length;
  const commentTooLong = isCommentTooLong(comment);

  function validate(): string | null {
    if (!project.trim()) return "Укажите проект";
    if (selectedCities.length === 0) return "Выберите хотя бы один город";
    if (selectedPositions.length === 0) return "Выберите хотя бы одну должность";
    if (!validRange) return "Дата начала должна быть не позже даты окончания";
    if (!Number.isInteger(plannedCount) || plannedCount <= 0) return "Количество должно быть целым числом больше 0";
    if (commentTooLong) return "Комментарий не может быть длиннее 2000 символов";
    return null;
  }

  async function performSave() {
    setSaving(true);
    const ok = await onSubmit({
      project,
      cities: selectedCities,
      positions: selectedPositions,
      fromDate,
      toDate,
      plannedCount,
    });
    if (ok && (status !== "active" || normalizeComment(comment) !== null)) {
      const patch = { status, comment: normalizeComment(comment) };
      await Promise.all(
        selectedCities.flatMap((city) =>
          selectedPositions.map((position) => updateDemandRowMeta(project, city, position, patch)),
        ),
      );
    }
    setSaving(false);
    setConfirmOpen(false);
    if (ok) onClose();
  }

  async function handleSave() {
    const error = validate();
    if (error) {
      pushToast(error, "error");
      return;
    }
    if (isLargeBulkCount(totalCount)) {
      setConfirmOpen(true);
      return;
    }
    await performSave();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Добавить потребность"
      footer={
        <>
          <Button onClick={onClose}>Отмена</Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={saving || selectedCities.length === 0 || selectedPositions.length === 0}
          >
            {saving ? "Сохранение…" : "Сохранить"}
          </Button>
        </>
      }
    >
      <div className={primitives.field}>
        <label>Проект</label>
        <Combobox value={project} onChange={setProject} options={projectOptions} />
      </div>

      <div className={primitives.field}>
        <label>Города</label>
        {selectedCities.length > 0 && (
          <div className={styles.cityTagRow}>
            {selectedCities.map((c) => (
              <span key={c} className={styles.cityTag}>
                {c}
                <button type="button" onClick={() => removeCity(c)} aria-label={`Убрать ${c}`}>
                  <Icon name="x" size={12} />
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
            <Icon name="plus" size={14} />
          </Button>
        </div>
      </div>

      <div className={primitives.field}>
        <label>Должности</label>
        {selectedPositions.length > 0 && (
          <div className={styles.cityTagRow}>
            {selectedPositions.map((p) => (
              <span key={p} className={styles.cityTag}>
                {p}
                <button type="button" onClick={() => removePosition(p)} aria-label={`Убрать ${p}`}>
                  <Icon name="x" size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className={styles.cityInputRow}>
          <Combobox
            value={positionInput}
            onChange={(v) => (positionOptions.includes(v) ? addPosition(v) : setPositionInput(v))}
            options={positionOptions}
            placeholder="Добавить должность"
            emptyHint="Список пуст — добавьте значения в Настройках → Списки для кандидатов."
          />
          <Button size="sm" onClick={() => addPosition(positionInput)} disabled={!positionInput.trim()}>
            <Icon name="plus" size={14} />
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
        <label>Количество сотрудников (на каждый день, город и должность)</label>
        <input
          type="number"
          min={1}
          value={plannedCount}
          onChange={(e) => setPlannedCount(parseInt(e.target.value || "0", 10))}
        />
      </div>

      <div className={primitives.fieldRow}>
        <div className={primitives.field}>
          <label>Статус строки (необязательно)</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as DemandRowStatus)}>
            {DEMAND_ROW_STATUSES.map((s) => (
              <option key={s} value={s}>
                {DEMAND_ROW_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={primitives.field}>
        <label>Комментарий (необязательно)</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Например: город временно не принимает новых сотрудников"
          rows={3}
        />
        <div className={styles.rowCommentCounter}>
          {comment.trim().length} / {DEMAND_COMMENT_MAX_LENGTH}
        </div>
      </div>

      {totalCount > 0 && (
        <p className={styles.bulkNotice}>
          Будет создано или обновлено <strong>{totalCount}</strong> {pluralizeValues(totalCount)} потребности.
        </p>
      )}

      {confirmOpen && (
        <Modal
          open
          onClose={() => setConfirmOpen(false)}
          title="Подтвердите добавление"
          footer={
            <>
              <Button onClick={() => setConfirmOpen(false)} disabled={saving}>
                Отмена
              </Button>
              <Button variant="primary" onClick={performSave} disabled={saving}>
                {saving ? "Сохранение…" : "Всё верно, сохранить"}
              </Button>
            </>
          }
        >
          <p>
            Это затронет <strong>{totalCount}</strong> {pluralizeValues(totalCount)} потребности — {selectedCities.length}{" "}
            город(ов) × {selectedPositions.length} должность(ей) × {dayCount} дн. Проверьте параметры перед сохранением.
          </p>
        </Modal>
      )}
    </Modal>
  );
}
