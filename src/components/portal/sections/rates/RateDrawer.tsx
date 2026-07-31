"use client";

import { useEffect, useMemo, useState } from "react";
import { usePortal } from "@/components/portal/context/PortalContext";
import { Badge } from "@/components/portal/ui/Badge";
import { Button } from "@/components/portal/ui/Button";
import { Combobox } from "@/components/portal/ui/Combobox";
import { Drawer } from "@/components/portal/ui/Drawer";
import { Icon } from "@/components/portal/ui/Icon";
import { activeListOptions } from "@/lib/portal/candidateOptions";
import { fmtDateTime, fmtMoney } from "@/lib/portal/format";
import type { RateExtra, RateOfficeStatus, RateSchedule, RateUnit, RateUpdate } from "@/lib/supabase/rates.types";
import primitives from "@/components/portal/ui/primitives.module.css";
import { incomePerMonth, incomePerShift, incomePerWeek } from "./rateMetrics";
import {
  OFFICE_STATUS_LABELS,
  OFFICE_STATUSES,
  PAYROLL_BANK_OPTIONS,
  RATE_SCHEDULES,
  RATE_UNITS,
  SCHEDULE_LABELS,
  UNIT_LABELS,
  unitHasPieceRate,
} from "./rateOptions";
import styles from "./RatesSection.module.css";

type RateDraft = {
  position: string;
  unit: RateUnit;
  rate_hour: string;
  rate_hour_priority: string;
  rate_piece: string;
  pieces_per_shift: string;
  rate_shift: string;
  shift_hours: string;
  surcharge_per_shift: string;
  schedule: RateSchedule | "";
  comment: string;
};

type CardDraft = {
  project: string;
  city: string;
  legal_entity: string;
  payroll_banks: string[];
  bonuses: string;
  promotions: string;
  surcharges: string;
  hiring_conditions: string;
  notes: string;
  manager: string;
  office_status: RateOfficeStatus;
};

function toNumOrNull(v: string): number | null {
  const trimmed = v.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function RateDrawer({ rateId }: { rateId: string | null }) {
  const {
    rates,
    rateCards,
    closeRateDrawer,
    saveRate,
    deleteRateRecord,
    saveRateCard,
    deleteRateCardRecord,
    listOptions,
  } = usePortal();

  const rate = rateId ? rates.find((r) => r.id === rateId) : undefined;
  const card = rate ? rateCards.find((c) => c.id === rate.rate_card_id) : undefined;
  const siblingCount = useMemo(
    () => (card ? rates.filter((r) => r.rate_card_id === card.id).length : 0),
    [rates, card],
  );

  const [rateDraft, setRateDraft] = useState<RateDraft | null>(null);
  const [cardDraft, setCardDraft] = useState<CardDraft | null>(null);
  const [extras, setExtras] = useState<RateExtra[]>([]);
  const [extraLabel, setExtraLabel] = useState("");
  const [extraValue, setExtraValue] = useState("");
  const [saving, setSaving] = useState(false);

  const positionOptions = activeListOptions(listOptions, "position").map((o) => o.value);
  const managerOptions = activeListOptions(listOptions, "manager").map((o) => o.value);

  useEffect(() => {
    if (!rate || !card) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset local draft when the selected rate changes
      setRateDraft(null);
      setCardDraft(null);
      setExtras([]);
      return;
    }
    setRateDraft({
      position: rate.position,
      unit: rate.unit as RateUnit,
      rate_hour: rate.rate_hour === null ? "" : String(rate.rate_hour),
      rate_hour_priority: rate.rate_hour_priority === null ? "" : String(rate.rate_hour_priority),
      rate_piece: rate.rate_piece === null ? "" : String(rate.rate_piece),
      pieces_per_shift: rate.pieces_per_shift === null ? "" : String(rate.pieces_per_shift),
      rate_shift: rate.rate_shift === null ? "" : String(rate.rate_shift),
      shift_hours: String(rate.shift_hours),
      surcharge_per_shift: rate.surcharge_per_shift === null ? "" : String(rate.surcharge_per_shift),
      schedule: (rate.schedule as RateSchedule | null) ?? "",
      comment: rate.comment ?? "",
    });
    setExtras(rate.extras);
    setCardDraft({
      project: card.project,
      city: card.city,
      legal_entity: card.legal_entity,
      payroll_banks: card.payroll_banks,
      bonuses: card.bonuses ?? "",
      promotions: card.promotions ?? "",
      surcharges: card.surcharges ?? "",
      hiring_conditions: card.hiring_conditions ?? "",
      notes: card.notes ?? "",
      manager: card.manager ?? "",
      office_status: card.office_status as RateOfficeStatus,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rate?.id]);

  function setRateField<K extends keyof RateDraft>(key: K, value: RateDraft[K]) {
    setRateDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function setCardField<K extends keyof CardDraft>(key: K, value: CardDraft[K]) {
    setCardDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function toggleBank(slug: string) {
    setCardDraft((prev) =>
      prev
        ? {
            ...prev,
            payroll_banks: prev.payroll_banks.includes(slug)
              ? prev.payroll_banks.filter((b) => b !== slug)
              : [...prev.payroll_banks, slug],
          }
        : prev,
    );
  }

  function addExtra() {
    if (!extraLabel.trim() || !extraValue.trim()) return;
    setExtras((prev) => [...prev, { id: crypto.randomUUID(), label: extraLabel.trim(), value: extraValue.trim() }]);
    setExtraLabel("");
    setExtraValue("");
  }

  function removeExtra(id: string) {
    setExtras((prev) => prev.filter((e) => e.id !== id));
  }

  async function handleSaveRate() {
    if (!rate || !rateDraft) return;
    if (!rateDraft.position.trim()) return;
    setSaving(true);
    const patch: RateUpdate = {
      position: rateDraft.position.trim(),
      unit: rateDraft.unit,
      rate_hour: toNumOrNull(rateDraft.rate_hour),
      rate_hour_priority: toNumOrNull(rateDraft.rate_hour_priority),
      rate_piece: toNumOrNull(rateDraft.rate_piece),
      pieces_per_shift: toNumOrNull(rateDraft.pieces_per_shift),
      rate_shift: toNumOrNull(rateDraft.rate_shift),
      shift_hours: toNumOrNull(rateDraft.shift_hours) ?? 12,
      surcharge_per_shift: toNumOrNull(rateDraft.surcharge_per_shift),
      schedule: rateDraft.schedule || null,
      comment: rateDraft.comment.trim() || null,
      extras,
    };
    await saveRate(rate.id, patch);
    setSaving(false);
  }

  async function handleSaveCard() {
    if (!card || !cardDraft) return;
    setSaving(true);
    await saveRateCard(card.id, {
      payroll_banks: cardDraft.payroll_banks,
      bonuses: cardDraft.bonuses.trim() || null,
      promotions: cardDraft.promotions.trim() || null,
      surcharges: cardDraft.surcharges.trim() || null,
      hiring_conditions: cardDraft.hiring_conditions.trim() || null,
      notes: cardDraft.notes.trim() || null,
      manager: cardDraft.manager.trim() || null,
      office_status: cardDraft.office_status,
    });
    setSaving(false);
  }

  async function handleDeleteRate() {
    if (!rate) return;
    if (!window.confirm(`Удалить ставку «${rate.position}»?`)) return;
    const ok = await deleteRateRecord(rate.id);
    if (ok) closeRateDrawer();
  }

  async function handleDeleteCard() {
    if (!card) return;
    const warning =
      siblingCount > 1
        ? `Удалить блок условий «${card.project}, ${card.city}»? Вместе с ним удалятся все ${siblingCount} ставки этого блока.`
        : `Удалить блок условий «${card.project}, ${card.city}»?`;
    if (!window.confirm(warning)) return;
    const ok = await deleteRateCardRecord(card.id);
    if (ok) closeRateDrawer();
  }

  return (
    <Drawer open={!!(rate && card)} onClose={closeRateDrawer} label="Карточка ставки">
      {rate && card && rateDraft && cardDraft && (
        <>
          <div className={styles.drawerHead}>
            <div>
              <h3>{rate.position}</h3>
              <p>
                {card.project}, {card.city}
                {card.legal_entity ? ` · ${card.legal_entity}` : ""}
              </p>
            </div>
            <button
              className={`${primitives.btnIcon} ${primitives.btnIconSm} ${primitives.btnIconOutlined}`}
              onClick={closeRateDrawer}
              aria-label="Закрыть"
            >
              <Icon name="x" size={16} />
            </button>
          </div>

          <div className={styles.drawerBody}>
            <div className={styles.serviceInfo}>
              <div>
                <span className={primitives.muted}>Создана</span>
                <span>
                  {fmtDateTime(new Date(rate.created_at))}
                  {rate.created_by_login ? ` · ${rate.created_by_login}` : ""}
                </span>
              </div>
              <div>
                <span className={primitives.muted}>Обновлена</span>
                <span>
                  {fmtDateTime(new Date(rate.updated_at))}
                  {rate.updated_by_login ? ` · ${rate.updated_by_login}` : ""}
                </span>
              </div>
            </div>

            <div className={styles.section}>
              <h4>Ставка</h4>
              <div className={primitives.fieldRow}>
                <div className={primitives.field}>
                  <label>Должность</label>
                  <Combobox value={rateDraft.position} onChange={(v) => setRateField("position", v)} options={positionOptions} />
                </div>
                <div className={primitives.field}>
                  <label>Единица измерения</label>
                  <select value={rateDraft.unit} onChange={(e) => setRateField("unit", e.target.value as RateUnit)}>
                    {RATE_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {UNIT_LABELS[u]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className={styles.section}>
              <h4>Тариф</h4>
              <div className={primitives.fieldRow}>
                <div className={primitives.field}>
                  <label>Ставка за час</label>
                  <input
                    type="number"
                    min={0}
                    value={rateDraft.rate_hour}
                    onChange={(e) => setRateField("rate_hour", e.target.value)}
                  />
                </div>
                <div className={primitives.field}>
                  <label>Приоритетная ставка за час</label>
                  <input
                    type="number"
                    min={0}
                    value={rateDraft.rate_hour_priority}
                    onChange={(e) => setRateField("rate_hour_priority", e.target.value)}
                  />
                </div>
              </div>
              {unitHasPieceRate(rateDraft.unit) && (
                <div className={primitives.fieldRow}>
                  <div className={primitives.field}>
                    <label>Ставка за единицу</label>
                    <input
                      type="number"
                      min={0}
                      value={rateDraft.rate_piece}
                      onChange={(e) => setRateField("rate_piece", e.target.value)}
                    />
                  </div>
                  <div className={primitives.field}>
                    <label>Единиц за смену</label>
                    <input
                      type="number"
                      min={0}
                      value={rateDraft.pieces_per_shift}
                      onChange={(e) => setRateField("pieces_per_shift", e.target.value)}
                    />
                  </div>
                </div>
              )}
              <div className={primitives.fieldRow}>
                <div className={primitives.field}>
                  <label>Фиксированная оплата за смену</label>
                  <input
                    type="number"
                    min={0}
                    value={rateDraft.rate_shift}
                    onChange={(e) => setRateField("rate_shift", e.target.value)}
                  />
                </div>
                <div className={primitives.field}>
                  <label>Часов в смене</label>
                  <input
                    type="number"
                    min={1}
                    max={24}
                    value={rateDraft.shift_hours}
                    onChange={(e) => setRateField("shift_hours", e.target.value)}
                  />
                </div>
              </div>
              <div className={primitives.fieldRow}>
                <div className={primitives.field}>
                  <label>Средняя надбавка за смену</label>
                  <input
                    type="number"
                    min={0}
                    value={rateDraft.surcharge_per_shift}
                    onChange={(e) => setRateField("surcharge_per_shift", e.target.value)}
                  />
                </div>
                <div className={primitives.field}>
                  <label>График</label>
                  <select value={rateDraft.schedule} onChange={(e) => setRateField("schedule", e.target.value as RateSchedule | "")}>
                    <option value="">Не указан</option>
                    {RATE_SCHEDULES.map((s) => (
                      <option key={s} value={s}>
                        {SCHEDULE_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className={styles.computedNote}>
                За смену: {fmtMoney(Math.round(incomePerShift(rate)))} · За неделю:{" "}
                {incomePerWeek(rate) === null ? "—" : fmtMoney(Math.round(incomePerWeek(rate)!))} · За месяц:{" "}
                {incomePerMonth(rate) === null ? "—" : fmtMoney(Math.round(incomePerMonth(rate)!))} (считается
                автоматически по сохранённым значениям, не хранится)
              </p>
              <Button size="sm" onClick={handleSaveRate} disabled={saving}>
                {saving ? "Сохранение…" : "Сохранить ставку"}
              </Button>
            </div>

            <div className={styles.section}>
              <h4>Дополнительные показатели</h4>
              {extras.length > 0 && (
                <div className={styles.documentList}>
                  {extras.map((ex) => (
                    <div className={styles.documentRow} key={ex.id}>
                      <span>
                        {ex.label}: {ex.value}
                      </span>
                      <button onClick={() => removeExtra(ex.id)} aria-label="Удалить показатель" title="Удалить показатель">
                        <Icon name="x" size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className={primitives.fieldRow}>
                <div className={primitives.field}>
                  <label>Название</label>
                  <input value={extraLabel} onChange={(e) => setExtraLabel(e.target.value)} placeholder="Оплата за стоп SLA 15" />
                </div>
                <div className={primitives.field}>
                  <label>Значение</label>
                  <input value={extraValue} onChange={(e) => setExtraValue(e.target.value)} placeholder="25 ₽" />
                </div>
              </div>
              <Button size="sm" onClick={addExtra} disabled={!extraLabel.trim() || !extraValue.trim()}>
                <Icon name="plus" size={14} />
                Добавить показатель
              </Button>
            </div>

            <div className={styles.section}>
              <h4>Комментарий</h4>
              <textarea
                className={styles.commentTextarea}
                value={rateDraft.comment}
                onChange={(e) => setRateField("comment", e.target.value)}
                rows={3}
              />
            </div>

            <div className={styles.section}>
              <h4>Условия проекта в городе</h4>
              <p className={styles.computedNote}>
                {siblingCount > 1
                  ? `Общие для ${siblingCount} ставок этого блока — изменение затронет их все.`
                  : "Пока единственная ставка этого блока."}
              </p>
              <div className={primitives.fieldRow}>
                <div className={primitives.field}>
                  <label>Менеджер</label>
                  <Combobox value={cardDraft.manager} onChange={(v) => setCardField("manager", v)} options={managerOptions} />
                </div>
                <div className={primitives.field}>
                  <label>Работа офиса</label>
                  <select
                    value={cardDraft.office_status}
                    onChange={(e) => setCardField("office_status", e.target.value as RateOfficeStatus)}
                  >
                    {OFFICE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {OFFICE_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className={primitives.field}>
                <label>Зарплатные проекты</label>
                <div className={styles.featureGrid}>
                  {PAYROLL_BANK_OPTIONS.map((b) => (
                    <label key={b.slug} className={primitives.checkLabel}>
                      <input
                        type="checkbox"
                        checked={cardDraft.payroll_banks.includes(b.slug)}
                        onChange={() => toggleBank(b.slug)}
                      />
                      {b.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className={primitives.field}>
                <label>Бонусы</label>
                <textarea
                  className={styles.commentTextarea}
                  value={cardDraft.bonuses}
                  onChange={(e) => setCardField("bonuses", e.target.value)}
                  rows={3}
                />
              </div>
              <div className={primitives.field}>
                <label>Временные акции</label>
                <textarea
                  className={styles.commentTextarea}
                  value={cardDraft.promotions}
                  onChange={(e) => setCardField("promotions", e.target.value)}
                  rows={2}
                />
              </div>
              <div className={primitives.field}>
                <label>Надбавки</label>
                <textarea
                  className={styles.commentTextarea}
                  value={cardDraft.surcharges}
                  onChange={(e) => setCardField("surcharges", e.target.value)}
                  rows={2}
                />
              </div>
              <div className={primitives.field}>
                <label>Дополнительные условия оформления</label>
                <textarea
                  className={styles.commentTextarea}
                  value={cardDraft.hiring_conditions}
                  onChange={(e) => setCardField("hiring_conditions", e.target.value)}
                  rows={2}
                />
              </div>
              <div className={primitives.field}>
                <label>Примечания</label>
                <textarea
                  className={styles.commentTextarea}
                  value={cardDraft.notes}
                  onChange={(e) => setCardField("notes", e.target.value)}
                  rows={2}
                />
              </div>
              <Button size="sm" onClick={handleSaveCard} disabled={saving}>
                {saving ? "Сохранение…" : "Сохранить условия блока"}
              </Button>
            </div>
          </div>

          <div className={styles.drawerFoot}>
            <Badge color="gray">{siblingCount > 1 ? `В блоке: ${siblingCount} ставок` : "Единственная в блоке"}</Badge>
            <Button danger onClick={handleDeleteRate}>
              <Icon name="x" size={14} />
              Удалить ставку
            </Button>
            <Button danger onClick={handleDeleteCard}>
              <Icon name="box" size={14} />
              Удалить блок условий
            </Button>
          </div>
        </>
      )}
    </Drawer>
  );
}
