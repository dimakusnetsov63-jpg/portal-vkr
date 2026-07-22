"use client";

import { useEffect, useMemo, useState } from "react";
import { usePortal } from "@/components/portal/context/PortalContext";
import { Badge } from "@/components/portal/ui/Badge";
import { Button } from "@/components/portal/ui/Button";
import { Icon } from "@/components/portal/ui/Icon";
import { Modal } from "@/components/portal/ui/Modal";
import { PageHead } from "@/components/portal/ui/PageHead";
import { Panel } from "@/components/portal/ui/Panel";
import { StatCard } from "@/components/portal/ui/StatCard";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/portal/ui/StateViews";
import { useHorizontalScrollSync } from "@/components/portal/ui/useHorizontalScrollSync";
import { RECRUITERS } from "@/lib/portal/constants";
import { CANDIDATE_PROJECTS, CANDIDATE_STAGES, medicalBookLabel, stageColor } from "@/lib/portal/candidateOptions";
import { avatarColor, fmtDateTime, initials } from "@/lib/portal/format";
import type { Candidate, CandidateInsert, CandidateProject } from "@/lib/supabase/candidates.types";
import primitives from "@/components/portal/ui/primitives.module.css";
import styles from "./CandidatesSection.module.css";

const PAGE_SIZE = 20;

export function CandidatesSection() {
  const {
    realCandidates,
    realCandidatesLoading,
    realCandidatesError,
    refreshRealCandidates,
    addRealCandidate,
    openRealCandidateDrawer,
    pushToast,
    setContextAction,
  } = usePortal();

  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    setContextAction({ label: "Добавить кандидата", onClick: () => setModalOpen(true) });
    return () => setContextAction(null);
  }, [setContextAction]);

  function resetFilters() {
    setSearch("");
    setProjectFilter("");
    setStageFilter("");
    setShowArchived(false);
    setVisible(PAGE_SIZE);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return realCandidates.filter((c) => {
      if (!showArchived && c.archived_at) return false;
      if (projectFilter && c.project !== projectFilter) return false;
      if (stageFilter && (c.stage ?? "") !== stageFilter) return false;
      if (q) {
        const haystack = [c.full_name, c.phone, c.telegram_tag, c.max_tag, c.external_id, c.city]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [realCandidates, search, projectFilter, stageFilter, showArchived]);

  const activeCount = realCandidates.filter((c) => !c.archived_at).length;
  const withFirstShift = realCandidates.filter((c) => !c.archived_at && c.first_shift_at).length;
  const withMedicalBook = realCandidates.filter((c) => !c.archived_at && c.has_medical_book === true).length;
  const archivedCount = realCandidates.filter((c) => c.archived_at).length;

  function exportCsv() {
    const header = [
      "ФИО",
      "External ID",
      "Проект",
      "Город",
      "Стадия",
      "Рекрутер",
      "Менеджер",
      "Координатор",
      "Телефон",
      "Telegram",
      "MAX",
      "Медкнижка",
      "1-я смена",
      "Архивирован",
    ];
    const lines = [header.join(";")].concat(
      filtered.map((c) =>
        [
          c.full_name,
          c.external_id ?? "",
          c.project,
          c.city ?? "",
          c.stage ?? "",
          c.recruiter ?? "",
          c.manager ?? "",
          c.coordinator ?? "",
          c.phone ?? "",
          c.telegram_tag ?? "",
          c.max_tag ?? "",
          medicalBookLabel(c.has_medical_book),
          c.first_shift_at ? (fmtDateTime(new Date(c.first_shift_at)) ?? "") : "",
          c.archived_at ? "да" : "нет",
        ].join(";"),
      ),
    );
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "staffflow-candidates.csv";
    a.click();
    URL.revokeObjectURL(url);
    pushToast("Экспорт сформирован: staffflow-candidates.csv");
  }

  const visibleRows = filtered.slice(0, visible);

  return (
    <>
      <PageHead eyebrow="Подбор">Реестр кандидатов на реальных данных — от прибытия на проект до архивации.</PageHead>

      <div className={primitives.statGrid}>
        <StatCard value={activeCount.toLocaleString("ru-RU")} label="Активные" />
        <StatCard value={withFirstShift.toLocaleString("ru-RU")} label="С 1-й сменой" />
        <StatCard value={withMedicalBook.toLocaleString("ru-RU")} label="Есть медкнижка" />
        <StatCard value={archivedCount.toLocaleString("ru-RU")} label="В архиве" />
      </div>

      <Panel>
        <div className={primitives.toolbar}>
          <div className={primitives.searchField} style={{ minWidth: 240 }}>
            <Icon name="search" size={15} />
            <input
              type="text"
              placeholder="Поиск по ФИО, телефону, telegram, ID, городу"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setVisible(PAGE_SIZE);
              }}
            />
          </div>
          <select
            className={primitives.select}
            value={projectFilter}
            onChange={(e) => {
              setProjectFilter(e.target.value);
              setVisible(PAGE_SIZE);
            }}
          >
            <option value="">Все проекты</option>
            {CANDIDATE_PROJECTS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select
            className={primitives.select}
            value={stageFilter}
            onChange={(e) => {
              setStageFilter(e.target.value);
              setVisible(PAGE_SIZE);
            }}
          >
            <option value="">Все стадии</option>
            {CANDIDATE_STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <label className={styles.archiveToggle}>
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => {
                setShowArchived(e.target.checked);
                setVisible(PAGE_SIZE);
              }}
            />
            Показывать архив
          </label>
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Сбросить
          </Button>
          <div className={primitives.spacer} />
          <Button size="sm" onClick={exportCsv}>
            <Icon name="download" size={14} />
            Экспорт
          </Button>
          <Button variant="primary" size="sm" onClick={() => setModalOpen(true)}>
            <Icon name="plus" size={14} />
            Добавить кандидата
          </Button>
        </div>

        {realCandidatesLoading && <SkeletonRows rows={9} />}
        {!realCandidatesLoading && realCandidatesError && <ErrorState onRetry={refreshRealCandidates} />}
        {!realCandidatesLoading &&
          !realCandidatesError &&
          (filtered.length === 0 ? (
            <EmptyState
              title="Кандидаты не найдены"
              text="Измените условия поиска, сбросьте фильтры или добавьте первого кандидата."
              onReset={resetFilters}
            />
          ) : (
            <CandidatesTable
              rows={visibleRows}
              total={filtered.length}
              onRowClick={openRealCandidateDrawer}
              onLoadMore={() => setVisible((v) => v + PAGE_SIZE)}
            />
          ))}
      </Panel>

      {modalOpen && <AddCandidateModal onClose={() => setModalOpen(false)} onSubmit={addRealCandidate} />}
    </>
  );
}

function CandidatesTable({
  rows,
  total,
  onRowClick,
  onLoadMore,
}: {
  rows: Candidate[];
  total: number;
  onRowClick: (id: string) => void;
  onLoadMore: () => void;
}) {
  const { scrollRef, fakeRef, innerWidth } = useHorizontalScrollSync();

  return (
    <div className={styles.tableWrap}>
      <div className={`${styles.tableScroll} scroll-x`} ref={scrollRef}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.colSticky} style={{ width: 220 }}>
                ФИО
              </th>
              <th>Проект</th>
              <th>Город</th>
              <th>Стадия</th>
              <th>Рекрутер</th>
              <th>Менеджер</th>
              <th>Координатор</th>
              <th>External ID</th>
              <th>1-я смена</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} onClick={() => onRowClick(c.id)}>
                <td className={styles.colSticky}>
                  <div className={styles.nameCell}>
                    <div
                      style={{
                        width: 26,
                        height: 26,
                        fontSize: 10,
                        borderRadius: "50%",
                        background: avatarColor(c.full_name),
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        flex: "none",
                      }}
                    >
                      {initials(c.full_name)}
                    </div>
                    {c.full_name}
                    {c.archived_at && (
                      <span className={primitives.muted} style={{ fontSize: 11 }}>
                        (вышел)
                      </span>
                    )}
                  </div>
                </td>
                <td>{c.project}</td>
                <td>{c.city || "—"}</td>
                <td>
                  <Badge color={stageColor(c.stage)}>{c.stage ?? "Не начал"}</Badge>
                </td>
                <td className={primitives.muted}>{c.recruiter || "—"}</td>
                <td className={primitives.muted}>{c.manager || "—"}</td>
                <td className={primitives.muted}>{c.coordinator || "—"}</td>
                <td className={`${primitives.mono} ${primitives.muted}`}>{c.external_id || "—"}</td>
                <td className={primitives.mono}>{c.first_shift_at ? fmtDateTime(new Date(c.first_shift_at)) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={`${styles.hscrollFake} scroll-x`} ref={fakeRef}>
        <div className={styles.hscrollFakeInner} style={{ width: `${innerWidth}px` }} />
      </div>
      <footer className={styles.pager}>
        <span>
          Показано {rows.length} из {total}
        </span>
        {rows.length < total ? (
          <Button size="sm" onClick={onLoadMore}>
            Показать ещё
          </Button>
        ) : (
          <span>Прокрутите таблицу ползунком снизу →</span>
        )}
      </footer>
    </div>
  );
}

function AddCandidateModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (input: CandidateInsert) => Promise<boolean>;
}) {
  const { pushToast } = usePortal();
  const [fullName, setFullName] = useState("");
  const [project, setProject] = useState<CandidateProject>(CANDIDATE_PROJECTS[0]);
  const [city, setCity] = useState("");
  const [recruiter, setRecruiter] = useState("");
  const [saving, setSaving] = useState(false);

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
          <input type="text" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
      </div>
      <div className={primitives.field}>
        <label>Рекрутер</label>
        <input list="add-candidate-recruiters" value={recruiter} onChange={(e) => setRecruiter(e.target.value)} />
        <datalist id="add-candidate-recruiters">
          {RECRUITERS.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
      </div>
      <p style={{ fontSize: 12, color: "var(--text-3)" }}>
        Остальные поля (телефон, стадия, медкнижка, даты и т.д.) можно заполнить после создания — откройте карточку
        кандидата.
      </p>
    </Modal>
  );
}
