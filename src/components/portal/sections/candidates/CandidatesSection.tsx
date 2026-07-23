"use client";

import { useEffect, useMemo, useState } from "react";
import { usePortal } from "@/components/portal/context/PortalContext";
import { Button } from "@/components/portal/ui/Button";
import { Icon } from "@/components/portal/ui/Icon";
import { PageHead } from "@/components/portal/ui/PageHead";
import { Panel } from "@/components/portal/ui/Panel";
import { StatCard } from "@/components/portal/ui/StatCard";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/portal/ui/StateViews";
import { CANDIDATE_PROJECTS, CANDIDATE_STAGES, medicalBookLabel } from "@/lib/portal/candidateOptions";
import { fmtDateTime } from "@/lib/portal/format";
import primitives from "@/components/portal/ui/primitives.module.css";
import { AddCandidateModal } from "./AddCandidateModal";
import { CandidatesTable } from "./CandidatesTable";
import { filterCandidates } from "./candidateFilters";
import { calculateCandidateMetrics } from "./candidateMetrics";
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

  const filtered = useMemo(
    () => filterCandidates(realCandidates, { search, project: projectFilter, stage: stageFilter, showArchived }),
    [realCandidates, search, projectFilter, stageFilter, showArchived],
  );

  const stats = useMemo(() => calculateCandidateMetrics(filtered), [filtered]);

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
    a.download = "vkr-candidates.csv";
    a.click();
    URL.revokeObjectURL(url);
    pushToast("Экспорт сформирован: vkr-candidates.csv");
  }

  const visibleRows = filtered.slice(0, visible);

  return (
    <>
      <PageHead eyebrow="Подбор">Реестр кандидатов на реальных данных — от прибытия на проект до архивации.</PageHead>

      <div className={styles.statGrid3}>
        <StatCard
          value={stats.awaiting.toLocaleString("ru-RU")}
          sublabel={`${stats.awaitingPct}% от выборки`}
          label="Ожидают выхода"
        />
        <StatCard
          value={stats.successful.toLocaleString("ru-RU")}
          sublabel={`${stats.successfulPct}% от выборки`}
          label="Успешно вышли"
        />
        <StatCard
          value={stats.medical.toLocaleString("ru-RU")}
          sublabel={`${stats.medicalPct}% от выборки`}
          label="Есть медкнижка"
        />
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
