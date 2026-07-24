"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { usePortal } from "@/components/portal/context/PortalContext";
import { Button } from "@/components/portal/ui/Button";
import { Icon } from "@/components/portal/ui/Icon";
import { PageHead } from "@/components/portal/ui/PageHead";
import { Panel } from "@/components/portal/ui/Panel";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/portal/ui/StateViews";
import { activeListOptions } from "@/lib/portal/candidateOptions";
import { defaultDemandWindow, getWeekRange, isWeekWindow, shiftWindow } from "@/lib/portal/demandWindow";
import { AddDemandModal } from "./AddDemandModal";
import { DemandMatrix } from "./DemandMatrix";
import { DemandToolbar } from "./DemandToolbar";
import { buildDemandMatrix, filterGroupsByCellPredicate, getDayColumns, listVisibleProjectCities } from "./demandAggregate";
import { filterDemandRows } from "./demandFilters";
import { parseDemandParams, serializeDemandParams } from "./demandQueryParams";
import styles from "./DemandSection.module.css";

export function DemandSection() {
  const {
    demandRows,
    demandLoading,
    demandError,
    demandWindow,
    setDemandWindow,
    refreshDemand,
    upsertDemandCell,
    deleteDemandCell,
    addDemandBulk,
    listOptions,
    setContextAction,
  } = usePortal();

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [filledOnly, setFilledOnly] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [scrollToTodayTick, setScrollToTodayTick] = useState(0);
  const [initializedFromUrl, setInitializedFromUrl] = useState(false);

  useEffect(() => {
    setContextAction({ label: "Добавить потребность", onClick: () => setModalOpen(true) });
    return () => setContextAction(null);
  }, [setContextAction]);

  // Read the initial state from the URL once, after mount.
  useEffect(() => {
    if (initializedFromUrl) return;
    const parsed = parseDemandParams(searchParams);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from the URL on mount
    if (parsed.project) setProjectFilter(parsed.project);
    if (parsed.city) setCityFilter(parsed.city);
    if (parsed.q) setSearch(parsed.q);
    if (parsed.filled !== undefined) setFilledOnly(parsed.filled);
    if (parsed.from && parsed.to) setDemandWindow({ from: parsed.from, to: parsed.to });
    setInitializedFromUrl(true);
  }, [initializedFromUrl, searchParams, setDemandWindow]);

  // Keep the URL in sync with the current filters/window, once initialized.
  useEffect(() => {
    if (!initializedFromUrl) return;
    const params = serializeDemandParams({
      section: "demand",
      project: projectFilter,
      city: cityFilter,
      q: search,
      filled: filledOnly,
      from: demandWindow.from,
      to: demandWindow.to,
    });
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [initializedFromUrl, projectFilter, cityFilter, search, filledOnly, demandWindow, pathname, router]);

  const cityOptions = useMemo(() => activeListOptions(listOptions, "city").map((o) => o.value), [listOptions]);

  const filtered = useMemo(
    () => filterDemandRows(demandRows, { search, project: projectFilter, city: cityFilter }),
    [demandRows, search, projectFilter, cityFilter],
  );

  const visible = useMemo(() => listVisibleProjectCities(filtered), [filtered]);
  const matrix = useMemo(() => buildDemandMatrix(filtered), [filtered]);
  const columns = useMemo(() => getDayColumns(demandWindow.from, demandWindow.to), [demandWindow]);

  const groupedRaw = useMemo(() => {
    const byProject = new Map<string, string[]>();
    for (const { project, city } of visible) {
      if (!byProject.has(project)) byProject.set(project, []);
      byProject.get(project)!.push(city);
    }
    return Array.from(byProject.entries()).map(([project, cities]) => ({ project, cities }));
  }, [visible]);

  const grouped = useMemo(
    () => (filledOnly ? filterGroupsByCellPredicate(groupedRaw, matrix, (v) => v > 0) : groupedRaw),
    [groupedRaw, matrix, filledOnly],
  );

  const filtersActive = Boolean(search || projectFilter || cityFilter || filledOnly);

  function resetFilters() {
    setSearch("");
    setProjectFilter("");
    setCityFilter("");
    setFilledOnly(false);
  }

  function toggleCollapsed(project: string) {
    setCollapsed((prev) => ({ ...prev, [project]: !prev[project] }));
  }

  function expandAll() {
    setCollapsed({});
  }

  function collapseAll() {
    setCollapsed(Object.fromEntries(groupedRaw.map((g) => [g.project, true])));
  }

  function handleToday() {
    setDemandWindow(defaultDemandWindow());
    setScrollToTodayTick((t) => t + 1);
  }

  function currentWeekBase() {
    return isWeekWindow(demandWindow) ? demandWindow : getWeekRange();
  }

  function handlePrevWeek() {
    setDemandWindow(shiftWindow(currentWeekBase(), -7));
  }

  function handleNextWeek() {
    setDemandWindow(shiftWindow(currentWeekBase(), 7));
  }

  function handleCurrentWeek() {
    setDemandWindow(getWeekRange());
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
          filledOnly={filledOnly}
          onFilledOnlyChange={setFilledOnly}
          onReset={resetFilters}
          onAdd={() => setModalOpen(true)}
          onToday={handleToday}
          onPrevWeek={handlePrevWeek}
          onCurrentWeek={handleCurrentWeek}
          onNextWeek={handleNextWeek}
          onExpandAll={expandAll}
          onCollapseAll={collapseAll}
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
              scrollToTodaySignal={scrollToTodayTick}
            />
          ))}
      </Panel>

      {modalOpen && <AddDemandModal onClose={() => setModalOpen(false)} onSubmit={addDemandBulk} />}
    </>
  );
}
