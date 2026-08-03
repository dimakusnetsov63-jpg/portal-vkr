"use client";

import { useEffect, useMemo, useState } from "react";
import { usePortal } from "@/components/portal/context/PortalContext";
import { Button } from "@/components/portal/ui/Button";
import { Icon } from "@/components/portal/ui/Icon";
import { PageHead } from "@/components/portal/ui/PageHead";
import { Panel } from "@/components/portal/ui/Panel";
import { EmptyState, ErrorState, SkeletonCards, SkeletonRows } from "@/components/portal/ui/StateViews";
import styles from "./RatesSection.module.css";
import { activeListOptions } from "@/lib/portal/candidateOptions";
import { visibleProjectOptions } from "@/lib/auth/projectAccess";
import type { RateSchedule, RateUnit } from "@/lib/supabase/rates.types";
import primitives from "@/components/portal/ui/primitives.module.css";
import { AddRateModal } from "./AddRateModal";
import { RatesDashboard } from "./RatesDashboard";
import { RatesTable } from "./RatesTable";
import { RATE_SCHEDULES, RATE_UNITS, SCHEDULE_LABELS, UNIT_LABELS } from "./rateOptions";
import { filterRates, type RateFilters } from "./rateFilters";
import { calculateRateMetrics, joinRatesWithCards } from "./rateMetrics";

const EMPTY_FILTERS: RateFilters = {
  search: "",
  project: "",
  city: "",
  legalEntity: "",
  position: "",
  unit: "",
  schedule: "",
};

export function RatesSection() {
  const {
    rates,
    rateCards,
    ratesLoading,
    ratesError,
    refreshRates,
    openRateDrawer,
    listOptions,
    setContextAction,
    currentUser,
  } = usePortal();

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    setContextAction({ label: "Добавить ставку", onClick: () => setModalOpen(true) });
    return () => setContextAction(null);
  }, [setContextAction]);

  function setFilter<K extends keyof RateFilters>(key: K, value: RateFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function resetFilters() {
    setFilters(EMPTY_FILTERS);
  }

  const projectOptions = useMemo(
    () =>
      visibleProjectOptions(
        currentUser.role,
        currentUser.projects,
        activeListOptions(listOptions, "project").map((o) => o.value),
      ),
    [listOptions, currentUser.role, currentUser.projects],
  );
  const cityOptions = useMemo(() => activeListOptions(listOptions, "city").map((o) => o.value), [listOptions]);
  const legalEntityOptions = useMemo(
    () => activeListOptions(listOptions, "legal_entity").map((o) => o.value),
    [listOptions],
  );
  const positionOptions = useMemo(() => activeListOptions(listOptions, "position").map((o) => o.value), [listOptions]);

  const joined = useMemo(() => joinRatesWithCards(rates, rateCards), [rates, rateCards]);
  const visibleRows = useMemo(() => filterRates(joined, filters), [joined, filters]);
  const stats = useMemo(() => calculateRateMetrics(visibleRows), [visibleRows]);

  return (
    <>
      <PageHead eyebrow="Подбор">Тарифы по проектам, городам и юр. лицам: ставка, доход за смену/неделю/месяц.</PageHead>

      {ratesLoading ? (
        <SkeletonCards count={8} className={styles.statGrid} />
      ) : (
        <RatesDashboard stats={stats} />
      )}

      <Panel>
        <div className={primitives.toolbar}>
          <div className={primitives.searchField} style={{ minWidth: 240 }}>
            <Icon name="search" size={16} />
            <input
              type="text"
              placeholder="Поиск по должности, проекту, городу, юр. лицу"
              value={filters.search}
              onChange={(e) => setFilter("search", e.target.value)}
            />
          </div>

          <select className={primitives.select} value={filters.project} onChange={(e) => setFilter("project", e.target.value)}>
            <option value="">Все проекты</option>
            {projectOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <select className={primitives.select} value={filters.city} onChange={(e) => setFilter("city", e.target.value)}>
            <option value="">Все города</option>
            {cityOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            className={primitives.select}
            value={filters.legalEntity}
            onChange={(e) => setFilter("legalEntity", e.target.value)}
          >
            <option value="">Все юр. лица</option>
            {legalEntityOptions.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>

          <select
            className={primitives.select}
            value={filters.position}
            onChange={(e) => setFilter("position", e.target.value)}
          >
            <option value="">Все должности</option>
            {positionOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <select
            className={primitives.select}
            value={filters.unit}
            onChange={(e) => setFilter("unit", e.target.value as RateUnit | "")}
          >
            <option value="">Все единицы</option>
            {RATE_UNITS.map((u) => (
              <option key={u} value={u}>
                {UNIT_LABELS[u]}
              </option>
            ))}
          </select>

          <select
            className={primitives.select}
            value={filters.schedule}
            onChange={(e) => setFilter("schedule", e.target.value as RateSchedule | "")}
          >
            <option value="">Все графики</option>
            {RATE_SCHEDULES.map((s) => (
              <option key={s} value={s}>
                {SCHEDULE_LABELS[s]}
              </option>
            ))}
          </select>

          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Сбросить
          </Button>
          <div className={primitives.spacer} />
          <Button variant="primary" size="sm" onClick={() => setModalOpen(true)}>
            <Icon name="plus" size={14} />
            Добавить ставку
          </Button>
        </div>

        {ratesLoading && <SkeletonRows rows={9} />}
        {!ratesLoading && ratesError && <ErrorState onRetry={refreshRates} />}
        {!ratesLoading &&
          !ratesError &&
          (visibleRows.length === 0 ? (
            <EmptyState
              title="Ставки не найдены"
              text="Измените условия поиска, сбросьте фильтры или добавьте первую ставку."
              onReset={resetFilters}
            />
          ) : (
            <RatesTable rows={visibleRows} onRowClick={openRateDrawer} />
          ))}
      </Panel>

      {modalOpen && <AddRateModal onClose={() => setModalOpen(false)} />}
    </>
  );
}
