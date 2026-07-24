"use client";

import { useEffect, useMemo, useState } from "react";
import { usePortal } from "@/components/portal/context/PortalContext";
import { Button } from "@/components/portal/ui/Button";
import { Icon } from "@/components/portal/ui/Icon";
import { PageHead } from "@/components/portal/ui/PageHead";
import { Panel } from "@/components/portal/ui/Panel";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/portal/ui/StateViews";
import { activeListOptions } from "@/lib/portal/candidateOptions";
import { AddDemandModal } from "./AddDemandModal";
import { DemandMatrix } from "./DemandMatrix";
import { DemandToolbar } from "./DemandToolbar";
import { buildDemandMatrix, getDayColumns, listVisibleProjectCities } from "./demandAggregate";
import { filterDemandRows } from "./demandFilters";
import styles from "./DemandSection.module.css";

export function DemandSection() {
  const {
    demandRows,
    demandLoading,
    demandError,
    demandWindow,
    refreshDemand,
    upsertDemandCell,
    deleteDemandCell,
    addDemandBulk,
    listOptions,
    setContextAction,
  } = usePortal();

  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    setContextAction({ label: "Добавить потребность", onClick: () => setModalOpen(true) });
    return () => setContextAction(null);
  }, [setContextAction]);

  const cityOptions = useMemo(() => activeListOptions(listOptions, "city").map((o) => o.value), [listOptions]);

  const filtered = useMemo(
    () => filterDemandRows(demandRows, { search, project: projectFilter, city: cityFilter }),
    [demandRows, search, projectFilter, cityFilter],
  );

  const visible = useMemo(() => listVisibleProjectCities(filtered), [filtered]);
  const matrix = useMemo(() => buildDemandMatrix(filtered), [filtered]);
  const columns = useMemo(() => getDayColumns(demandWindow.from, demandWindow.to), [demandWindow]);

  const grouped = useMemo(() => {
    const byProject = new Map<string, string[]>();
    for (const { project, city } of visible) {
      if (!byProject.has(project)) byProject.set(project, []);
      byProject.get(project)!.push(city);
    }
    return Array.from(byProject.entries()).map(([project, cities]) => ({ project, cities }));
  }, [visible]);

  const filtersActive = Boolean(search || projectFilter || cityFilter);

  function resetFilters() {
    setSearch("");
    setProjectFilter("");
    setCityFilter("");
  }

  function toggleCollapsed(project: string) {
    setCollapsed((prev) => ({ ...prev, [project]: !prev[project] }));
  }

  function handleSaveCell(project: string, city: string, dateIso: string, next: number | null) {
    return next === null ? deleteDemandCell(project, city, dateIso) : upsertDemandCell(project, city, dateIso, next);
  }

  return (
    <>
      <PageHead eyebrow="Планирование">Матрица потребности в персонале по проектам, городам и датам.</PageHead>

      <Panel>
        <DemandToolbar
          search={search}
          onSearchChange={setSearch}
          project={projectFilter}
          onProjectChange={setProjectFilter}
          city={cityFilter}
          onCityChange={setCityFilter}
          cityOptions={cityOptions}
          onReset={resetFilters}
          onAdd={() => setModalOpen(true)}
        />

        {demandLoading && <SkeletonRows rows={8} />}
        {!demandLoading && demandError && <ErrorState onRetry={refreshDemand} />}
        {!demandLoading &&
          !demandError &&
          (grouped.length === 0 ? (
            filtersActive ? (
              <EmptyState
                title="Ничего не найдено"
                text="Попробуйте изменить фильтры или сбросить поиск."
                onReset={resetFilters}
              />
            ) : (
              <>
                <EmptyState title="Потребность ещё не выставлена" text="Добавьте первый проект, город и период." />
                <div className={styles.emptyAction}>
                  <Button variant="primary" size="sm" onClick={() => setModalOpen(true)}>
                    <Icon name="plus" size={14} />
                    Добавить потребность
                  </Button>
                </div>
              </>
            )
          ) : (
            <DemandMatrix
              grouped={grouped}
              columns={columns}
              matrix={matrix}
              collapsed={collapsed}
              onToggleCollapse={toggleCollapsed}
              onSaveCell={handleSaveCell}
            />
          ))}
      </Panel>

      {modalOpen && <AddDemandModal onClose={() => setModalOpen(false)} onSubmit={addDemandBulk} />}
    </>
  );
}
