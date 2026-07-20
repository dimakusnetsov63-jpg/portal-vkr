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
import { CITIES, PROJECTS, RECRUITERS, STAGES, projectById, stageById } from "@/lib/portal/constants";
import { avatarColor, fmtDateTime, initials } from "@/lib/portal/format";
import type { Candidate, NewCandidateInput, StageId } from "@/lib/portal/types";
import primitives from "@/components/portal/ui/primitives.module.css";
import styles from "./CandidatesSection.module.css";

type DemoState = "normal" | "loading" | "empty" | "error";

const PAGE_SIZE = 20;

export function CandidatesSection() {
  const { candidates, addCandidate, openCandidateDrawer, pushToast, setContextAction } = usePortal();

  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [stageFilter, setStageFilter] = useState<StageId | "">("");
  const [recruiterFilter, setRecruiterFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [demoState, setDemoState] = useState<DemoState>("normal");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    setContextAction({ label: "Добавить кандидата", onClick: () => setModalOpen(true) });
    return () => setContextAction(null);
  }, [setContextAction]);

  function resetFilters() {
    setSearch("");
    setProjectFilter("");
    setCityFilter("");
    setStageFilter("");
    setRecruiterFilter("");
    setDateFilter("");
    setVisible(PAGE_SIZE);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return candidates.filter((c) => {
      if (q && !(c.fio.toLowerCase().includes(q) || c.id.toLowerCase().includes(q))) return false;
      if (projectFilter && c.project !== projectFilter) return false;
      if (cityFilter && c.city !== cityFilter) return false;
      if (stageFilter && c.stage !== stageFilter) return false;
      if (recruiterFilter && c.recruiter !== recruiterFilter) return false;
      if (dateFilter && c.responseAt.toDateString() !== new Date(dateFilter).toDateString()) return false;
      return true;
    });
  }, [candidates, search, projectFilter, cityFilter, stageFilter, recruiterFilter, dateFilter]);

  const total = candidates.length;
  const invited = candidates.filter((c) =>
    (["invited", "interview", "processing", "confirmed", "first_shift"] as StageId[]).includes(c.stage),
  ).length;
  const processed = candidates.filter((c) => (["processing", "confirmed", "first_shift"] as StageId[]).includes(c.stage)).length;
  const shifted = candidates.filter((c) => c.stage === "first_shift").length;

  function exportCsv() {
    const header = ["ФИО", "Проект", "Город", "Стадия", "Рекрутер", "Менеджер", "Координатор", "ID", "Отклик", "Приглашение", "Оформление", "1-я смена"];
    const lines = [header.join(";")].concat(
      filtered.map((c) => {
        const proj = projectById(c.project);
        const stage = stageById(c.stage);
        return [
          c.fio,
          proj?.name ?? "",
          c.city,
          stage.name,
          c.recruiter,
          c.manager,
          c.coordinator,
          c.id,
          fmtDateTime(c.responseAt) ?? "",
          fmtDateTime(c.invitedAt) ?? "",
          fmtDateTime(c.processedAt) ?? "",
          fmtDateTime(c.firstShiftAt) ?? "",
        ].join(";");
      }),
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
      <PageHead eyebrow="Подбор">Единый реестр кандидатов и история движения по этапам найма.</PageHead>

      <div className={primitives.statGrid}>
        <StatCard value={total.toLocaleString("ru-RU")} label="Отклики" />
        <StatCard value={invited.toLocaleString("ru-RU")} label={`Приглашены · ${Math.round((invited / total) * 100)}%`} />
        <StatCard value={processed.toLocaleString("ru-RU")} label={`Оформление · ${Math.round((processed / invited) * 100)}%`} />
        <StatCard value={shifted.toLocaleString("ru-RU")} label={`1-я смена · ${Math.round((shifted / processed) * 100)}%`} />
      </div>

      <Panel>
        <div className={primitives.toolbar}>
          <div className={primitives.searchField} style={{ minWidth: 220 }}>
            <Icon name="search" size={15} />
            <input
              type="text"
              placeholder="Поиск по ФИО или ID"
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
            {PROJECTS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            className={primitives.select}
            value={cityFilter}
            onChange={(e) => {
              setCityFilter(e.target.value);
              setVisible(PAGE_SIZE);
            }}
          >
            <option value="">Все города</option>
            {CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            className={primitives.select}
            value={stageFilter}
            onChange={(e) => {
              setStageFilter(e.target.value as StageId | "");
              setVisible(PAGE_SIZE);
            }}
          >
            <option value="">Все стадии</option>
            {STAGES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            className={primitives.select}
            value={recruiterFilter}
            onChange={(e) => {
              setRecruiterFilter(e.target.value);
              setVisible(PAGE_SIZE);
            }}
          >
            <option value="">Все рекрутеры</option>
            {RECRUITERS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <input
            type="date"
            className={`${primitives.select} ${primitives.dateInput}`}
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value);
              setVisible(PAGE_SIZE);
            }}
          />
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Сбросить
          </Button>
          <div className={primitives.spacer} />
          <div className={primitives.demoStateControl}>
            Состояние:
            <select value={demoState} onChange={(e) => setDemoState(e.target.value as DemoState)}>
              <option value="normal">Обычное</option>
              <option value="loading">Загрузка</option>
              <option value="empty">Пустой результат</option>
              <option value="error">Ошибка</option>
            </select>
          </div>
          <Button size="sm" onClick={exportCsv}>
            <Icon name="download" size={14} />
            Экспорт
          </Button>
          <Button variant="primary" size="sm" onClick={() => setModalOpen(true)}>
            <Icon name="plus" size={14} />
            Добавить кандидата
          </Button>
        </div>

        {demoState === "loading" && <SkeletonRows rows={9} />}
        {demoState === "error" && <ErrorState onRetry={() => setDemoState("normal")} />}
        {demoState !== "loading" &&
          demoState !== "error" &&
          (demoState === "empty" || filtered.length === 0 ? (
            <EmptyState title="Кандидаты не найдены" text="Измените условия поиска или сбросьте фильтры." onReset={resetFilters} />
          ) : (
            <CandidatesTable
              rows={visibleRows}
              total={filtered.length}
              onRowClick={openCandidateDrawer}
              onLoadMore={() => setVisible((v) => v + PAGE_SIZE)}
            />
          ))}
      </Panel>

      {modalOpen && <AddCandidateModal onClose={() => setModalOpen(false)} onSubmit={addCandidate} />}
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
              <th>ID</th>
              <th>Отклик</th>
              <th>Приглашение</th>
              <th>Оформление</th>
              <th>1-я смена</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const stage = stageById(c.stage);
              const proj = projectById(c.project);
              return (
                <tr key={c.id} onClick={() => onRowClick(c.id)}>
                  <td className={styles.colSticky}>
                    <div className={styles.nameCell}>
                      <div
                        style={{
                          width: 26,
                          height: 26,
                          fontSize: 10,
                          borderRadius: "50%",
                          background: avatarColor(c.fio),
                          color: "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          flex: "none",
                        }}
                      >
                        {initials(c.fio)}
                      </div>
                      {c.fio}
                    </div>
                  </td>
                  <td>{proj?.name ?? "—"}</td>
                  <td>{c.city}</td>
                  <td>
                    <Badge color={stage.color}>{stage.name}</Badge>
                  </td>
                  <td className={primitives.muted}>{c.recruiter}</td>
                  <td className={primitives.muted}>{c.manager}</td>
                  <td className={primitives.muted}>{c.coordinator}</td>
                  <td className={`${primitives.mono} ${primitives.muted}`}>{c.id}</td>
                  <td className={primitives.mono}>{fmtDateTime(c.responseAt) ?? "—"}</td>
                  <td className={primitives.mono}>{fmtDateTime(c.invitedAt) ?? "—"}</td>
                  <td className={primitives.mono}>{fmtDateTime(c.processedAt) ?? "—"}</td>
                  <td className={primitives.mono}>{fmtDateTime(c.firstShiftAt) ?? "—"}</td>
                </tr>
              );
            })}
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
  onSubmit: (input: NewCandidateInput) => void;
}) {
  const [fio, setFio] = useState("");
  const [projectId, setProjectId] = useState(PROJECTS[0].id);
  const [city, setCity] = useState(PROJECTS[0].cities[0]);
  const [recruiter, setRecruiter] = useState(RECRUITERS[0]);
  const [stage, setStage] = useState<StageId>("response");
  const { pushToast } = usePortal();

  const project = PROJECTS.find((p) => p.id === projectId) ?? PROJECTS[0];

  function handleSave() {
    if (!fio.trim()) {
      pushToast("Укажите ФИО кандидата", "error");
      return;
    }
    onSubmit({ fio: fio.trim(), project: projectId, city, recruiter, stage });
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Добавить кандидата"
      footer={
        <>
          <Button onClick={onClose}>Отмена</Button>
          <Button variant="primary" onClick={handleSave}>
            Добавить
          </Button>
        </>
      }
    >
      <div className={primitives.field}>
        <label>ФИО</label>
        <input type="text" placeholder="Иванов Иван Иванович" value={fio} onChange={(e) => setFio(e.target.value)} />
      </div>
      <div className={primitives.fieldRow}>
        <div className={primitives.field}>
          <label>Проект</label>
          <select
            value={projectId}
            onChange={(e) => {
              const p = PROJECTS.find((x) => x.id === e.target.value) ?? PROJECTS[0];
              setProjectId(p.id);
              setCity(p.cities[0]);
            }}
          >
            {PROJECTS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className={primitives.field}>
          <label>Город</label>
          <select value={city} onChange={(e) => setCity(e.target.value)}>
            {project.cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className={primitives.fieldRow}>
        <div className={primitives.field}>
          <label>Рекрутер</label>
          <select value={recruiter} onChange={(e) => setRecruiter(e.target.value)}>
            {RECRUITERS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div className={primitives.field}>
          <label>Стадия</label>
          <select value={stage} onChange={(e) => setStage(e.target.value as StageId)}>
            {STAGES.slice(0, 3).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </Modal>
  );
}
