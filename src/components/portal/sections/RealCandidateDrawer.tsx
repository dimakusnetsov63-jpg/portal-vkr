"use client";

import { useEffect, useState } from "react";
import { usePortal } from "@/components/portal/context/PortalContext";
import { Badge } from "@/components/portal/ui/Badge";
import { Button } from "@/components/portal/ui/Button";
import { Combobox } from "@/components/portal/ui/Combobox";
import { Drawer } from "@/components/portal/ui/Drawer";
import { Icon } from "@/components/portal/ui/Icon";
import {
  activeListOptions,
  CANDIDATE_PROJECTS,
  CANDIDATE_STAGES,
  medicalBookLabel,
  stageColor,
} from "@/lib/portal/candidateOptions";
import { avatarColor, initials } from "@/lib/portal/format";
import type { Candidate, CandidateUpdate } from "@/lib/supabase/candidates.types";
import primitives from "@/components/portal/ui/primitives.module.css";
import styles from "./CandidateDrawer.module.css";

const TIMELINE_FIELDS: { key: "invitation_at" | "registration_at" | "first_shift_at"; label: string }[] = [
  { key: "invitation_at", label: "Приглашение" },
  { key: "registration_at", label: "Оформление" },
  { key: "first_shift_at", label: "1-я смена" },
];

const MEDICAL_BOOK_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Не указано" },
  { value: "true", label: "Есть" },
  { value: "false", label: "Нет" },
];

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

type Draft = {
  full_name: string;
  project: string;
  city: string;
  stage: string;
  recruiter: string;
  manager: string;
  coordinator: string;
  source: string;
  phone: string;
  telegram_tag: string;
  max_tag: string;
  salary_card: string;
  has_medical_book: string;
  comment: string;
  invitation_at: string;
  registration_at: string;
  first_shift_at: string;
};

function draftFromCandidate(c: Candidate): Draft {
  return {
    full_name: c.full_name,
    project: c.project,
    city: c.city ?? "",
    stage: c.stage ?? "",
    recruiter: c.recruiter ?? "",
    manager: c.manager ?? "",
    coordinator: c.coordinator ?? "",
    source: c.source ?? "",
    phone: c.phone ?? "",
    telegram_tag: c.telegram_tag ?? "",
    max_tag: c.max_tag ?? "",
    salary_card: c.salary_card ?? "",
    has_medical_book: c.has_medical_book === null ? "" : String(c.has_medical_book),
    comment: c.comment ?? "",
    invitation_at: toDatetimeLocal(c.invitation_at),
    registration_at: toDatetimeLocal(c.registration_at),
    first_shift_at: toDatetimeLocal(c.first_shift_at),
  };
}

export function RealCandidateDrawer({ candidateId }: { candidateId: string | null }) {
  const {
    realCandidates,
    closeRealCandidateDrawer,
    saveRealCandidate,
    archiveRealCandidate,
    restoreRealCandidate,
    listOptions,
  } = usePortal();

  const candidate = candidateId ? realCandidates.find((c) => c.id === candidateId) : undefined;

  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const cityOptions = activeListOptions(listOptions, "city").map((o) => o.value);
  const recruiterOptions = activeListOptions(listOptions, "recruiter").map((o) => o.value);
  const managerOptions = activeListOptions(listOptions, "manager").map((o) => o.value);
  const coordinatorOptions = activeListOptions(listOptions, "coordinator").map((o) => o.value);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset local draft when the selected candidate changes
    setDraft(candidate ? draftFromCandidate(candidate) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate?.id]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handleSave() {
    if (!candidate || !draft) return;
    if (!draft.full_name.trim()) return;
    setSaving(true);
    const patch: CandidateUpdate = {
      full_name: draft.full_name.trim(),
      project: draft.project as CandidateUpdate["project"],
      city: draft.city.trim() || null,
      stage: (draft.stage || null) as CandidateUpdate["stage"],
      recruiter: draft.recruiter.trim() || null,
      manager: draft.manager.trim() || null,
      coordinator: draft.coordinator.trim() || null,
      source: draft.source.trim() || null,
      phone: draft.phone.trim() || null,
      telegram_tag: draft.telegram_tag.trim() || null,
      max_tag: draft.max_tag.trim() || null,
      salary_card: draft.salary_card.trim() || null,
      has_medical_book: draft.has_medical_book === "" ? null : draft.has_medical_book === "true",
      comment: draft.comment.trim() || null,
      invitation_at: fromDatetimeLocal(draft.invitation_at),
      registration_at: fromDatetimeLocal(draft.registration_at),
      first_shift_at: fromDatetimeLocal(draft.first_shift_at),
    };
    await saveRealCandidate(candidate.id, patch);
    setSaving(false);
  }

  return (
    <Drawer open={!!candidate} onClose={closeRealCandidateDrawer}>
      {candidate && draft && (
        <>
          <div className={styles.head}>
            <div className={styles.avatar} style={{ background: avatarColor(candidate.full_name) }}>
              {initials(candidate.full_name)}
            </div>
            <div>
              <h3>{candidate.full_name}</h3>
              <p>
                {candidate.external_id ? `${candidate.external_id} · ` : ""}
                {candidate.project}
                {candidate.city ? `, ${candidate.city}` : ""}
              </p>
            </div>
            <button className={styles.close} onClick={closeRealCandidateDrawer} aria-label="Закрыть">
              <Icon name="x" size={16} />
            </button>
          </div>

          <div className={styles.body}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Badge color={stageColor(candidate.stage)}>{candidate.stage ?? "Не начал"}</Badge>
              {candidate.archived_at && <Badge color="red">Вышел</Badge>}
            </div>

            <div className={styles.section}>
              <h4>Основное</h4>
              <div className={primitives.field}>
                <label>ФИО</label>
                <input value={draft.full_name} onChange={(e) => set("full_name", e.target.value)} />
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
              <div className={primitives.field}>
                <label>Стадия</label>
                <select value={draft.stage} onChange={(e) => set("stage", e.target.value)}>
                  <option value="">Не начал</option>
                  {CANDIDATE_STAGES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.section}>
              <h4>Ответственные</h4>
              <div className={primitives.fieldRow}>
                <div className={primitives.field}>
                  <label>Рекрутер</label>
                  <Combobox value={draft.recruiter} onChange={(v) => set("recruiter", v)} options={recruiterOptions} />
                </div>
                <div className={primitives.field}>
                  <label>Менеджер</label>
                  <Combobox value={draft.manager} onChange={(v) => set("manager", v)} options={managerOptions} />
                </div>
              </div>
              <div className={primitives.fieldRow}>
                <div className={primitives.field}>
                  <label>Координатор</label>
                  <Combobox
                    value={draft.coordinator}
                    onChange={(v) => set("coordinator", v)}
                    options={coordinatorOptions}
                  />
                </div>
                <div className={primitives.field}>
                  <label>Источник</label>
                  <input value={draft.source} onChange={(e) => set("source", e.target.value)} />
                </div>
              </div>
            </div>

            <div className={styles.section}>
              <h4>Контакты</h4>
              <div className={primitives.fieldRow}>
                <div className={primitives.field}>
                  <label>Телефон</label>
                  <input value={draft.phone} onChange={(e) => set("phone", e.target.value)} />
                </div>
                <div className={primitives.field}>
                  <label>Telegram</label>
                  <input value={draft.telegram_tag} onChange={(e) => set("telegram_tag", e.target.value)} />
                </div>
              </div>
              <div className={primitives.fieldRow}>
                <div className={primitives.field}>
                  <label>MAX</label>
                  <input value={draft.max_tag} onChange={(e) => set("max_tag", e.target.value)} />
                </div>
                <div className={primitives.field}>
                  <label>Зарплатная карта</label>
                  <input value={draft.salary_card} onChange={(e) => set("salary_card", e.target.value)} />
                </div>
              </div>
            </div>

            <div className={styles.section}>
              <h4>Медицинская книжка</h4>
              <div className={primitives.field}>
                <select value={draft.has_medical_book} onChange={(e) => set("has_medical_book", e.target.value)}>
                  {MEDICAL_BOOK_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <p style={{ fontSize: 12, color: "var(--text-3)" }}>
                Сейчас: {medicalBookLabel(candidate.has_medical_book)}
              </p>
            </div>

            <div className={styles.section}>
              <h4>Временная шкала</h4>
              {TIMELINE_FIELDS.map((f) => (
                <div className={primitives.field} key={f.key}>
                  <label>{f.label}</label>
                  <input type="datetime-local" value={draft[f.key]} onChange={(e) => set(f.key, e.target.value)} />
                </div>
              ))}
            </div>

            <div className={styles.section}>
              <h4>Комментарий</h4>
              <textarea
                className={styles.commentTextarea}
                placeholder="Комментарий по кандидату…"
                value={draft.comment}
                onChange={(e) => set("comment", e.target.value)}
                rows={3}
              />
            </div>

            <div className={styles.section} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button variant="primary" onClick={handleSave} disabled={saving}>
                {saving ? "Сохранение…" : "Сохранить"}
              </Button>
              {candidate.archived_at ? (
                <Button onClick={() => restoreRealCandidate(candidate.id)}>
                  <Icon name="refresh" size={14} />
                  Восстановить
                </Button>
              ) : (
                <Button danger onClick={() => archiveRealCandidate(candidate.id)}>
                  <Icon name="x" size={14} />
                  Отметить как вышедшего
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </Drawer>
  );
}
