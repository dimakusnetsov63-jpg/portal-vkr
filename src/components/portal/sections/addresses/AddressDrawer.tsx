"use client";

import { useEffect, useState } from "react";
import { usePortal } from "@/components/portal/context/PortalContext";
import { Badge } from "@/components/portal/ui/Badge";
import { Button } from "@/components/portal/ui/Button";
import { Combobox } from "@/components/portal/ui/Combobox";
import { Drawer } from "@/components/portal/ui/Drawer";
import { Icon } from "@/components/portal/ui/Icon";
import { activeListOptions, CANDIDATE_PROJECTS } from "@/lib/portal/candidateOptions";
import { fmtDateTime } from "@/lib/portal/format";
import type {
  AddressObjectType,
  AddressPaymentType,
  AddressRow,
  AddressScheduleType,
  AddressShiftType,
  AddressStatus,
  AddressUpdate,
} from "@/lib/supabase/addresses.types";
import primitives from "@/components/portal/ui/primitives.module.css";
import { addressDeficit, addressFillRate } from "./addressMetrics";
import {
  FEATURE_OPTIONS,
  OBJECT_TYPE_LABELS,
  OBJECT_TYPES,
  PAYMENT_TYPE_LABELS,
  PAYMENT_TYPES,
  PRIORITY_LEVELS,
  priorityStars,
  SCHEDULE_TYPE_LABELS,
  SCHEDULE_TYPES,
  SHIFT_TYPE_LABELS,
  SHIFT_TYPES,
  STATUS_COLORS,
  ADDRESS_STATUSES,
  STATUS_LABELS,
} from "./addressOptions";
import styles from "./AddressesSection.module.css";

type Draft = {
  project: string;
  city: string;
  position: string;
  full_address: string;
  metro: string;
  district: string;
  latitude: string;
  longitude: string;
  object_type: AddressObjectType;
  required_count: string;
  staffed_count: string;
  planned_start_count: string;
  in_progress_count: string;
  status: AddressStatus;
  priority: number;
  schedule_type: AddressScheduleType | "";
  shift_type: AddressShiftType | "";
  shift_times: string;
  payment_type: AddressPaymentType | "";
  payment_amount: string;
  coordinator_name: string;
  coordinator_phone: string;
  coordinator_telegram: string;
  site_manager_name: string;
  site_manager_phone: string;
  coordinator_comment: string;
  features: string[];
};

function draftFromAddress(a: AddressRow): Draft {
  return {
    project: a.project,
    city: a.city,
    position: a.position ?? "",
    full_address: a.full_address,
    metro: a.metro ?? "",
    district: a.district ?? "",
    latitude: a.latitude === null ? "" : String(a.latitude),
    longitude: a.longitude === null ? "" : String(a.longitude),
    // object_type/status/schedule_type/shift_type/payment_type are CHECK
    // constraints, not enums (see addresses.types.ts) — the generated Row
    // type keeps them as plain `string`, narrowed here the same way
    // demandRowMeta.ts casts `status as DemandRowStatus`.
    object_type: a.object_type as AddressObjectType,
    required_count: String(a.required_count),
    staffed_count: String(a.staffed_count),
    planned_start_count: String(a.planned_start_count),
    in_progress_count: String(a.in_progress_count),
    status: a.status as AddressStatus,
    priority: a.priority,
    schedule_type: (a.schedule_type as AddressScheduleType | null) ?? "",
    shift_type: (a.shift_type as AddressShiftType | null) ?? "",
    shift_times: a.shift_times.join(", "),
    payment_type: (a.payment_type as AddressPaymentType | null) ?? "",
    payment_amount: a.payment_amount === null ? "" : String(a.payment_amount),
    coordinator_name: a.coordinator_name ?? "",
    coordinator_phone: a.coordinator_phone ?? "",
    coordinator_telegram: a.coordinator_telegram ?? "",
    site_manager_name: a.site_manager_name ?? "",
    site_manager_phone: a.site_manager_phone ?? "",
    coordinator_comment: a.coordinator_comment ?? "",
    features: a.features,
  };
}

function toIntOrZero(v: string): number {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function toNumberOrNull(v: string): number | null {
  const trimmed = v.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function AddressDrawer({ addressId }: { addressId: string | null }) {
  const { addresses, closeAddressDrawer, saveAddress, archiveAddressRecord, restoreAddressRecord, listOptions } =
    usePortal();

  const address = addressId ? addresses.find((a) => a.id === addressId) : undefined;

  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [docUrl, setDocUrl] = useState("");

  const cityOptions = activeListOptions(listOptions, "city").map((o) => o.value);
  const positionOptions = activeListOptions(listOptions, "position").map((o) => o.value);
  const coordinatorOptions = activeListOptions(listOptions, "coordinator").map((o) => o.value);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset local draft when the selected address changes
    setDraft(address ? draftFromAddress(address) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address?.id]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function toggleFeature(slug: string) {
    setDraft((prev) =>
      prev
        ? { ...prev, features: prev.features.includes(slug) ? prev.features.filter((f) => f !== slug) : [...prev.features, slug] }
        : prev,
    );
  }

  function addDocument() {
    if (!address || !docTitle.trim() || !docUrl.trim()) return;
    const link = { id: crypto.randomUUID(), title: docTitle.trim(), url: docUrl.trim(), type: "link" };
    saveAddress(address.id, { document_links: [...address.document_links, link] });
    setDocTitle("");
    setDocUrl("");
  }

  function removeDocument(id: string) {
    if (!address) return;
    saveAddress(address.id, { document_links: address.document_links.filter((d) => d.id !== id) });
  }

  async function handleSave() {
    if (!address || !draft) return;
    if (!draft.city.trim() || !draft.full_address.trim()) return;
    setSaving(true);
    const patch: AddressUpdate = {
      project: draft.project as AddressUpdate["project"],
      city: draft.city.trim(),
      position: draft.position.trim() || null,
      full_address: draft.full_address.trim(),
      metro: draft.metro.trim() || null,
      district: draft.district.trim() || null,
      latitude: toNumberOrNull(draft.latitude),
      longitude: toNumberOrNull(draft.longitude),
      object_type: draft.object_type,
      required_count: toIntOrZero(draft.required_count),
      staffed_count: toIntOrZero(draft.staffed_count),
      planned_start_count: toIntOrZero(draft.planned_start_count),
      in_progress_count: toIntOrZero(draft.in_progress_count),
      status: draft.status,
      priority: draft.priority,
      schedule_type: draft.schedule_type || null,
      shift_type: draft.shift_type || null,
      shift_times: draft.shift_times
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      payment_type: draft.payment_type || null,
      payment_amount: toNumberOrNull(draft.payment_amount),
      coordinator_name: draft.coordinator_name.trim() || null,
      coordinator_phone: draft.coordinator_phone.trim() || null,
      coordinator_telegram: draft.coordinator_telegram.trim() || null,
      site_manager_name: draft.site_manager_name.trim() || null,
      site_manager_phone: draft.site_manager_phone.trim() || null,
      coordinator_comment: draft.coordinator_comment.trim() || null,
      features: draft.features,
    };
    await saveAddress(address.id, patch);
    setSaving(false);
  }

  return (
    <Drawer open={!!address} onClose={closeAddressDrawer}>
      {address && draft && (
        <>
          <div className={styles.drawerHead}>
            <div>
              <h3>{address.full_address}</h3>
              <p>
                {address.project}, {address.city}
              </p>
            </div>
            <button className={styles.close} onClick={closeAddressDrawer} aria-label="Закрыть">
              <Icon name="x" size={16} />
            </button>
          </div>

          <div className={styles.drawerBody}>
            {/* Служебная информация карточки — доступна сразу, без отдельного экрана истории. */}
            <div className={styles.serviceInfo}>
              <div>
                <span className={primitives.muted}>Создан</span>
                <span>
                  {fmtDateTime(new Date(address.created_at))}
                  {address.created_by_login ? ` · ${address.created_by_login}` : ""}
                </span>
              </div>
              <div>
                <span className={primitives.muted}>Обновлён</span>
                <span>
                  {fmtDateTime(new Date(address.updated_at))}
                  {address.updated_by_login ? ` · ${address.updated_by_login}` : ""}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Badge color={STATUS_COLORS[address.status as AddressStatus]}>
                {STATUS_LABELS[address.status as AddressStatus]}
              </Badge>
              <Badge color={address.archived_at ? "red" : "green"}>{address.archived_at ? "Архив" : "Активен"}</Badge>
            </div>

            <div className={styles.section}>
              <h4>Основное</h4>
              <div className={primitives.field}>
                <label>Полный адрес</label>
                <input value={draft.full_address} onChange={(e) => set("full_address", e.target.value)} />
              </div>
              <div className={primitives.fieldRow}>
                <div className={primitives.field}>
                  <label>Проект</label>
                  <select value={draft.project} onChange={(e) => set("project", e.target.value)}>
                    {CANDIDATE_PROJECTS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={primitives.field}>
                  <label>Город</label>
                  <Combobox value={draft.city} onChange={(v) => set("city", v)} options={cityOptions} />
                </div>
              </div>
              <div className={primitives.fieldRow}>
                <div className={primitives.field}>
                  <label>Специализация</label>
                  <Combobox value={draft.position} onChange={(v) => set("position", v)} options={positionOptions} />
                </div>
                <div className={primitives.field}>
                  <label>Тип объекта</label>
                  <select value={draft.object_type} onChange={(e) => set("object_type", e.target.value as AddressObjectType)}>
                    {OBJECT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {OBJECT_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className={primitives.fieldRow}>
                <div className={primitives.field}>
                  <label>Метро</label>
                  <input value={draft.metro} onChange={(e) => set("metro", e.target.value)} />
                </div>
                <div className={primitives.field}>
                  <label>Район</label>
                  <input value={draft.district} onChange={(e) => set("district", e.target.value)} />
                </div>
              </div>
              <div className={primitives.fieldRow}>
                <div className={primitives.field}>
                  <label>Широта</label>
                  <input value={draft.latitude} onChange={(e) => set("latitude", e.target.value)} placeholder="55.751244" />
                </div>
                <div className={primitives.field}>
                  <label>Долгота</label>
                  <input value={draft.longitude} onChange={(e) => set("longitude", e.target.value)} placeholder="37.618423" />
                </div>
              </div>
            </div>

            <div className={styles.section}>
              <h4>Потребность и статус</h4>
              <div className={primitives.fieldRow}>
                <div className={primitives.field}>
                  <label>Требуется</label>
                  <input
                    type="number"
                    min={0}
                    value={draft.required_count}
                    onChange={(e) => set("required_count", e.target.value)}
                  />
                </div>
                <div className={primitives.field}>
                  <label>Есть сотрудников</label>
                  <input
                    type="number"
                    min={0}
                    value={draft.staffed_count}
                    onChange={(e) => set("staffed_count", e.target.value)}
                  />
                </div>
              </div>
              <div className={primitives.fieldRow}>
                <div className={primitives.field}>
                  <label>План выхода</label>
                  <input
                    type="number"
                    min={0}
                    value={draft.planned_start_count}
                    onChange={(e) => set("planned_start_count", e.target.value)}
                  />
                </div>
                <div className={primitives.field}>
                  <label>В работе</label>
                  <input
                    type="number"
                    min={0}
                    value={draft.in_progress_count}
                    onChange={(e) => set("in_progress_count", e.target.value)}
                  />
                </div>
              </div>
              <p style={{ fontSize: 12, color: "var(--text-3)" }}>
                Дефицит: {addressDeficit(address)} · Укомплектованность: {Math.round(addressFillRate(address))}%
                (считается автоматически, не хранится)
              </p>
              <div className={primitives.fieldRow}>
                <div className={primitives.field}>
                  <label>Статус набора</label>
                  <select value={draft.status} onChange={(e) => set("status", e.target.value as AddressStatus)}>
                    {ADDRESS_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={primitives.field}>
                  <label>Приоритет</label>
                  <select value={draft.priority} onChange={(e) => set("priority", Number(e.target.value))}>
                    {PRIORITY_LEVELS.map((p) => (
                      <option key={p} value={p}>
                        {priorityStars(p)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className={styles.section}>
              <h4>Графики и оплата</h4>
              <div className={primitives.fieldRow}>
                <div className={primitives.field}>
                  <label>График работы</label>
                  <select value={draft.schedule_type} onChange={(e) => set("schedule_type", e.target.value as AddressScheduleType | "")}>
                    <option value="">Не указан</option>
                    {SCHEDULE_TYPES.map((s) => (
                      <option key={s} value={s}>
                        {SCHEDULE_TYPE_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={primitives.field}>
                  <label>Смены</label>
                  <select value={draft.shift_type} onChange={(e) => set("shift_type", e.target.value as AddressShiftType | "")}>
                    <option value="">Не указаны</option>
                    {SHIFT_TYPES.map((s) => (
                      <option key={s} value={s}>
                        {SHIFT_TYPE_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className={primitives.field}>
                <label>Время выхода (через запятую)</label>
                <input value={draft.shift_times} onChange={(e) => set("shift_times", e.target.value)} placeholder="08:00, 14:00, 20:00" />
              </div>
              <div className={primitives.fieldRow}>
                <div className={primitives.field}>
                  <label>Тип оплаты</label>
                  <select value={draft.payment_type} onChange={(e) => set("payment_type", e.target.value as AddressPaymentType | "")}>
                    <option value="">Не указан</option>
                    {PAYMENT_TYPES.map((p) => (
                      <option key={p} value={p}>
                        {PAYMENT_TYPE_LABELS[p]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={primitives.field}>
                  <label>Размер оплаты</label>
                  <input value={draft.payment_amount} onChange={(e) => set("payment_amount", e.target.value)} placeholder="2500" />
                </div>
              </div>
            </div>

            <div className={styles.section}>
              <h4>Контакты</h4>
              <div className={primitives.fieldRow}>
                <div className={primitives.field}>
                  <label>Координатор</label>
                  <Combobox value={draft.coordinator_name} onChange={(v) => set("coordinator_name", v)} options={coordinatorOptions} />
                </div>
                <div className={primitives.field}>
                  <label>Телефон координатора</label>
                  <input value={draft.coordinator_phone} onChange={(e) => set("coordinator_phone", e.target.value)} />
                </div>
              </div>
              <div className={primitives.fieldRow}>
                <div className={primitives.field}>
                  <label>Telegram координатора</label>
                  <input value={draft.coordinator_telegram} onChange={(e) => set("coordinator_telegram", e.target.value)} />
                </div>
                <div className={primitives.field} />
              </div>
              <div className={primitives.fieldRow}>
                <div className={primitives.field}>
                  <label>Руководитель объекта</label>
                  <input value={draft.site_manager_name} onChange={(e) => set("site_manager_name", e.target.value)} />
                </div>
                <div className={primitives.field}>
                  <label>Телефон руководителя</label>
                  <input value={draft.site_manager_phone} onChange={(e) => set("site_manager_phone", e.target.value)} />
                </div>
              </div>
            </div>

            <div className={styles.section}>
              <h4>Комментарий координатора</h4>
              <textarea
                className={styles.commentTextarea}
                placeholder="Особенности объекта: берём только мужчин, есть бесплатное питание…"
                value={draft.coordinator_comment}
                onChange={(e) => set("coordinator_comment", e.target.value)}
                rows={3}
              />
            </div>

            <div className={styles.section}>
              <h4>Особенности объекта</h4>
              <div className={styles.featureGrid}>
                {FEATURE_OPTIONS.map((f) => (
                  <label key={f.slug} className={styles.featureCheckbox}>
                    <input
                      type="checkbox"
                      checked={draft.features.includes(f.slug)}
                      onChange={() => toggleFeature(f.slug)}
                    />
                    {f.label}
                  </label>
                ))}
              </div>
            </div>

            <div className={styles.section}>
              <h4>Документы (ссылки)</h4>
              {address.document_links.length > 0 && (
                <div className={styles.documentList}>
                  {address.document_links.map((d) => (
                    <div className={styles.documentRow} key={d.id}>
                      <a href={d.url} target="_blank" rel="noreferrer">
                        <Icon name="file" size={14} />
                        {d.title}
                      </a>
                      <button onClick={() => removeDocument(d.id)} aria-label="Удалить ссылку" title="Удалить ссылку">
                        <Icon name="x" size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className={primitives.fieldRow}>
                <div className={primitives.field}>
                  <label>Название</label>
                  <input value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="Схема прохода" />
                </div>
                <div className={primitives.field}>
                  <label>Ссылка</label>
                  <input value={docUrl} onChange={(e) => setDocUrl(e.target.value)} placeholder="https://…" />
                </div>
              </div>
              <Button size="sm" onClick={addDocument} disabled={!docTitle.trim() || !docUrl.trim()}>
                <Icon name="plus" size={14} />
                Добавить ссылку
              </Button>
            </div>

            <div className={styles.section} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button variant="primary" onClick={handleSave} disabled={saving}>
                {saving ? "Сохранение…" : "Сохранить"}
              </Button>
              {address.archived_at ? (
                <Button onClick={() => restoreAddressRecord(address.id)}>
                  <Icon name="refresh" size={14} />
                  Восстановить
                </Button>
              ) : (
                <Button danger onClick={() => archiveAddressRecord(address.id)}>
                  <Icon name="box" size={14} />
                  Перевести в архив
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </Drawer>
  );
}
