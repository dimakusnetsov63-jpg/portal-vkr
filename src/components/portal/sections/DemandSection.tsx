"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { usePortal } from "@/components/portal/context/PortalContext";
import { Button } from "@/components/portal/ui/Button";
import { Icon } from "@/components/portal/ui/Icon";
import { Modal } from "@/components/portal/ui/Modal";
import { PageHead } from "@/components/portal/ui/PageHead";
import { Panel } from "@/components/portal/ui/Panel";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/portal/ui/StateViews";
import { useHorizontalScrollSync } from "@/components/portal/ui/useHorizontalScrollSync";
import { CITIES, PROJECTS } from "@/lib/portal/constants";
import {
  aggregateCell,
  generateDemand,
  getScaleColumns,
  type DemandScale,
} from "@/lib/portal/generateDemand";
import type { DemandLevel, DemandMatrix } from "@/lib/portal/types";
import primitives from "@/components/portal/ui/primitives.module.css";
import styles from "./DemandSection.module.css";

type LevelFilter = DemandLevel | "";

const SCALE_OPTIONS: { value: DemandScale; label: string }[] = [
  { value: "day", label: "День" },
  { value: "week", label: "Неделя" },
  { value: "month", label: "Месяц" },
];

const LEVEL_OPTIONS: { value: LevelFilter; label: string }[] = [
  { value: "", label: "Любой уровень" },
  { value: "critical", label: "Критический дефицит" },
  { value: "elevated", label: "Повышенный" },
  { value: "normal", label: "Норма" },
  { value: "zero", label: "Нет потребности" },
];

type DemoState = "normal" | "loading" | "empty" | "error";

export function DemandSection() {
  const { setContextAction, pushToast } = usePortal();

  const [demand, setDemand] = useState<DemandMatrix>(() => generateDemand());
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("");
  const [scale, setScale] = useState<DemandScale>("day");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [demoState, setDemoState] = useState<DemoState>("normal");
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    setContextAction({ label: "Добавить потребность", onClick: () => setModalOpen(true) });
    return () => setContextAction(null);
  }, [setContextAction]);

  const columns = useMemo(() => getScaleColumns(scale), [scale]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const projects = PROJECTS.filter((p) => !projectFilter || p.id === projectFilter);
    return projects
      .map((project) => {
        let cities = project.cities.filter((c) => !cityFilter || c === cityFilter);
        if (q) {
          cities = cities.filter((c) => project.name.toLowerCase().includes(q) || c.toLowerCase().includes(q));
        } else if (search) {
          cities = [];
        }
        if (levelFilter) {
          cities = cities.filter((city) =>
            columns.some((col) => aggregateCell(demand[project.id][city], col.from, col.span).level === levelFilter),
          );
        }
        return { project, cities };
      })
      .filter((r) => r.cities.length > 0);
  }, [search, projectFilter, cityFilter, levelFilter, columns, demand]);

  function resetFilters() {
    setSearch("");
    setProjectFilter("");
    setCityFilter("");
    setLevelFilter("");
  }

  function toggleCollapsed(projectId: string) {
    setCollapsed((prev) => ({ ...prev, [projectId]: !prev[projectId] }));
  }

  function handleAddDemand(input: { projectId: string; city: string; date: Date; qty: number }) {
    setDemand((prev) => {
      const level: DemandLevel = input.qty === 0 ? "zero" : input.qty <= 4 ? "normal" : input.qty <= 9 ? "elevated" : "critical";
      const days = prev[input.projectId][input.city];
      const idx = days.findIndex((d) => d.date.toDateString() === input.date.toDateString());
      const nextDays =
        idx >= 0
          ? days.map((d, i) => (i === idx ? { ...d, need: input.qty, level } : d))
          : [...days, { date: input.date, need: input.qty, level }].sort((a, b) => a.date.getTime() - b.date.getTime());
      return {
        ...prev,
        [input.projectId]: { ...prev[input.projectId], [input.city]: nextDays },
      };
    });
    setModalOpen(false);
    pushToast("Потребность добавлена");
  }

  return (
    <>
      <PageHead eyebrow="Планирование">Матрица потребности в персонале по проектам, городам и датам.</PageHead>

      <Panel>
        <div className={primitives.toolbar}>
          <div className={primitives.searchField} style={{ minWidth: 200 }}>
            <Icon name="search" size={15} />
            <input
              type="text"
              placeholder="Поиск по проекту или городу"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className={primitives.select} value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
            <option value="">Все проекты</option>
            {PROJECTS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select className={primitives.select} value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>
            <option value="">Все города</option>
            {CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            className={primitives.select}
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value as LevelFilter)}
          >
            {LEVEL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Сбросить
          </Button>
          <div className={primitives.spacer} />
          <div className={primitives.seg}>
            {SCALE_OPTIONS.map((o) => (
              <button
                key={o.value}
                className={`${primitives.segButton} ${scale === o.value ? primitives.segButtonActive : ""}`}
                onClick={() => setScale(o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
          <Button variant="primary" size="sm" onClick={() => setModalOpen(true)}>
            <Icon name="plus" size={14} />
            Добавить потребность
          </Button>
        </div>

        <div className={primitives.legend}>
          <div className={primitives.legendItem}>
            <span className={primitives.legendSwatch} style={{ background: "var(--green-soft)", border: "1px solid var(--green)" }} />
            Норма
          </div>
          <div className={primitives.legendItem}>
            <span className={primitives.legendSwatch} style={{ background: "var(--amber-soft)", border: "1px solid var(--amber)" }} />
            Повышенная
          </div>
          <div className={primitives.legendItem}>
            <span className={primitives.legendSwatch} style={{ background: "var(--red-soft)", border: "1px solid var(--red)" }} />
            Критическая
          </div>
          <div className={primitives.legendItem}>
            <span className={primitives.legendSwatch} style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }} />
            Нет потребности
          </div>
          <div className={primitives.demoStateControl}>
            Состояние:
            <select value={demoState} onChange={(e) => setDemoState(e.target.value as DemoState)}>
              <option value="normal">Обычное</option>
              <option value="loading">Загрузка</option>
              <option value="empty">Пустой результат</option>
              <option value="error">Ошибка</option>
            </select>
          </div>
        </div>

        {demoState === "loading" && <SkeletonRows rows={8} />}
        {demoState === "error" && <ErrorState onRetry={() => setDemoState("normal")} />}
        {demoState !== "loading" &&
          demoState !== "error" &&
          (demoState === "empty" || rows.length === 0 ? (
            <EmptyState
              title="Ничего не найдено"
              text="Попробуйте изменить фильтры или сбросить поиск."
              onReset={resetFilters}
            />
          ) : (
            <DemandTable rows={rows} columns={columns} demand={demand} collapsed={collapsed} onToggle={toggleCollapsed} />
          ))}
      </Panel>

      {modalOpen && <AddDemandModal onClose={() => setModalOpen(false)} onSubmit={handleAddDemand} />}
    </>
  );
}

function DemandTable({
  rows,
  columns,
  demand,
  collapsed,
  onToggle,
}: {
  rows: { project: (typeof PROJECTS)[number]; cities: string[] }[];
  columns: ReturnType<typeof getScaleColumns>;
  demand: DemandMatrix;
  collapsed: Record<string, boolean>;
  onToggle: (projectId: string) => void;
}) {
  const { scrollRef, fakeRef, innerWidth } = useHorizontalScrollSync();

  return (
    <div className={styles.tableWrap}>
      <div className={`${styles.tableScroll} scroll-x`} ref={scrollRef}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={`${styles.headCell} ${styles.projectCol}`}>Проект / Город</th>
              {columns.map((col) => (
                <th key={col.key} className={`${styles.headCell} ${styles.dateCol} ${col.weekend ? styles.dateColWeekend : ""}`}>
                  {col.label}
                  <span className={styles.dow}>{col.sub}</span>
                </th>
              ))}
              <th className={`${styles.headCell} ${styles.dateCol}`}>Итого</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ project, cities }) => {
              const isCollapsed = !!collapsed[project.id];
              const projectTotal = cities.reduce(
                (sum, city) => sum + demand[project.id][city].reduce((a, d) => a + d.need, 0),
                0,
              );
              return (
                <Fragment key={project.id}>
                  <tr>
                    <td className={styles.colSticky}>
                      <div className={styles.projHead}>
                        <button onClick={() => onToggle(project.id)} aria-label="Свернуть/развернуть проект">
                          <span
                            className={`${styles.projHeadChevron} ${isCollapsed ? styles.projHeadCollapsedChevron : ""}`}
                          >
                            <Icon name="chevron" size={14} />
                          </span>
                        </button>
                        <span className={styles.swatch} style={{ background: project.color }} />
                        {project.name}
                        <span className={styles.projTotal}>{projectTotal} чел.</span>
                      </div>
                    </td>
                    {columns.map((col) => (
                      <td key={col.key} />
                    ))}
                    <td />
                  </tr>
                  {!isCollapsed &&
                    cities.map((city) => {
                      const days = demand[project.id][city];
                      const total = days.reduce((a, d) => a + d.need, 0);
                      return (
                        <tr key={`${project.id}-${city}`}>
                          <td className={styles.colSticky}>
                            <div className={styles.cityCell}>
                              <Icon name="mapPin" size={13} />
                              {city}
                            </div>
                          </td>
                          {columns.map((col) => {
                            const cell = aggregateCell(days, col.from, col.span);
                            const lvlClass =
                              cell.level === "zero"
                                ? styles.lvlZero
                                : cell.level === "normal"
                                  ? styles.lvlNormal
                                  : cell.level === "elevated"
                                    ? styles.lvlElevated
                                    : styles.lvlCritical;
                            return (
                              <td
                                key={col.key}
                                className={`${styles.demandCell} ${lvlClass}`}
                                title={`${city}, ${col.label}: ${cell.need} чел.`}
                              >
                                {cell.need || "—"}
                              </td>
                            );
                          })}
                          <td className={styles.totalCell}>{total}</td>
                        </tr>
                      );
                    })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className={`${styles.hscrollFake} scroll-x`} ref={fakeRef}>
        <div className={styles.hscrollFakeInner} style={{ width: `${innerWidth}px` }} />
      </div>
    </div>
  );
}

function AddDemandModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (input: { projectId: string; city: string; date: Date; qty: number }) => void;
}) {
  const [projectId, setProjectId] = useState(PROJECTS[0].id);
  const [city, setCity] = useState(PROJECTS[0].cities[0]);
  const [date, setDate] = useState(() => new Date(2026, 6, 20).toISOString().slice(0, 10));
  const [qty, setQty] = useState(5);

  const project = PROJECTS.find((p) => p.id === projectId) ?? PROJECTS[0];

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
            onClick={() => onSubmit({ projectId, city, date: new Date(date), qty })}
          >
            Сохранить
          </Button>
        </>
      }
    >
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
      <div className={primitives.fieldRow}>
        <div className={primitives.field}>
          <label>Дата</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className={primitives.field}>
          <label>Количество позиций</label>
          <input type="number" min={0} value={qty} onChange={(e) => setQty(parseInt(e.target.value || "0", 10))} />
        </div>
      </div>
      <div className={primitives.field}>
        <label>Комментарий (необязательно)</label>
        <textarea placeholder="Например: усиление на период акции" />
      </div>
    </Modal>
  );
}
