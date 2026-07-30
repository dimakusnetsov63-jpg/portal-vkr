"use client";

import { useEffect, useMemo, useState } from "react";
import { usePortal } from "@/components/portal/context/PortalContext";
import { Button } from "@/components/portal/ui/Button";
import { Icon } from "@/components/portal/ui/Icon";
import { PageHead } from "@/components/portal/ui/PageHead";
import { Panel } from "@/components/portal/ui/Panel";
import { EmptyState, ErrorState, SkeletonCards, SkeletonRows } from "@/components/portal/ui/StateViews";
import styles from "./AddressesSection.module.css";
import { activeListOptions, CANDIDATE_PROJECTS } from "@/lib/portal/candidateOptions";
import type { AddressObjectType, AddressStatus } from "@/lib/supabase/addresses.types";
import primitives from "@/components/portal/ui/primitives.module.css";
import { AddAddressModal } from "./AddAddressModal";
import { AddressesDashboard } from "./AddressesDashboard";
import { AddressesTable } from "./AddressesTable";
import { OBJECT_TYPE_LABELS, OBJECT_TYPES, PRIORITY_LEVELS, STATUS_LABELS, ADDRESS_STATUSES } from "./addressOptions";
import { filterAddresses, type AddressFilters } from "./addressFilters";
import { calculateAddressMetrics } from "./addressMetrics";

const EMPTY_FILTERS: Omit<AddressFilters, "showArchived"> = {
  search: "",
  project: "",
  city: "",
  position: "",
  district: "",
  metro: "",
  objectType: "",
  status: "",
  priority: 0,
  coordinator: "",
};

export function AddressesSection() {
  const {
    addresses,
    addressesLoading,
    addressesError,
    refreshAddresses,
    addAddress,
    openAddressDrawer,
    listOptions,
    setContextAction,
  } = usePortal();

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  // Сегментированный переключатель "Активные / Архив" — один экран, без
  // перехода между страницами (см. requirements/addresses.md).
  const [showArchived, setShowArchived] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    setContextAction({ label: "Добавить адрес", onClick: () => setModalOpen(true) });
    return () => setContextAction(null);
  }, [setContextAction]);

  function setFilter<K extends keyof typeof EMPTY_FILTERS>(key: K, value: (typeof EMPTY_FILTERS)[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function resetFilters() {
    setFilters(EMPTY_FILTERS);
  }

  const cityOptions = useMemo(() => activeListOptions(listOptions, "city").map((o) => o.value), [listOptions]);
  const positionOptions = useMemo(() => activeListOptions(listOptions, "position").map((o) => o.value), [listOptions]);
  const coordinatorOptions = useMemo(
    () => activeListOptions(listOptions, "coordinator").map((o) => o.value),
    [listOptions],
  );

  // Район/метро не имеют общего справочника (в отличие от города/должности/
  // координатора) — варианты фильтра строятся из уже загруженных данных, без
  // отдельного списка в Настройках.
  const districtOptions = useMemo(
    () => Array.from(new Set(addresses.map((a) => a.district).filter((v): v is string => Boolean(v)))).sort(),
    [addresses],
  );
  const metroOptions = useMemo(
    () => Array.from(new Set(addresses.map((a) => a.metro).filter((v): v is string => Boolean(v)))).sort(),
    [addresses],
  );

  const visibleRows = useMemo(
    () => filterAddresses(addresses, { ...filters, showArchived }),
    [addresses, filters, showArchived],
  );

  // KPI никогда не зависят от текущей вкладки Активные/Архив — архивные
  // адреса не участвуют в расчёте, даже если открыта вкладка «Архив».
  const activeForKpi = useMemo(
    () => filterAddresses(addresses, { ...filters, showArchived: false }),
    [addresses, filters],
  );

  const stats = useMemo(() => calculateAddressMetrics(addresses, activeForKpi), [addresses, activeForKpi]);

  return (
    <>
      <PageHead eyebrow="Подбор">Единая карточка объекта: потребность, статус набора и характеристики адреса.</PageHead>

      {addressesLoading ? (
        <SkeletonCards count={8} className={styles.statGrid8} />
      ) : (
        <AddressesDashboard stats={stats} />
      )}

      <Panel>
        <div className={primitives.toolbar}>
          <div className={`${primitives.pillTabs} ${primitives.pillTabsInline}`}>
            <button
              className={`${primitives.pillTabButton} ${!showArchived ? primitives.pillTabButtonActive : ""}`}
              onClick={() => setShowArchived(false)}
            >
              Активные
            </button>
            <button
              className={`${primitives.pillTabButton} ${showArchived ? primitives.pillTabButtonActive : ""}`}
              onClick={() => setShowArchived(true)}
            >
              Архив
            </button>
          </div>

          <div className={primitives.searchField} style={{ minWidth: 240 }}>
            <Icon name="search" size={16} />
            <input
              type="text"
              placeholder="Поиск по адресу, метро, району, координатору"
              value={filters.search}
              onChange={(e) => setFilter("search", e.target.value)}
            />
          </div>

          <select className={primitives.select} value={filters.project} onChange={(e) => setFilter("project", e.target.value)}>
            <option value="">Все проекты</option>
            {CANDIDATE_PROJECTS.map((p) => (
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
            value={filters.position}
            onChange={(e) => setFilter("position", e.target.value)}
          >
            <option value="">Все специализации</option>
            {positionOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <select
            className={primitives.select}
            value={filters.district}
            onChange={(e) => setFilter("district", e.target.value)}
          >
            <option value="">Все районы</option>
            {districtOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          <select className={primitives.select} value={filters.metro} onChange={(e) => setFilter("metro", e.target.value)}>
            <option value="">Все станции метро</option>
            {metroOptions.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <select
            className={primitives.select}
            value={filters.objectType}
            onChange={(e) => setFilter("objectType", e.target.value as AddressObjectType | "")}
          >
            <option value="">Все типы объекта</option>
            {OBJECT_TYPES.map((t) => (
              <option key={t} value={t}>
                {OBJECT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>

          <select
            className={primitives.select}
            value={filters.status}
            onChange={(e) => setFilter("status", e.target.value as AddressStatus | "")}
          >
            <option value="">Все статусы</option>
            {ADDRESS_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>

          <select
            className={primitives.select}
            value={filters.priority || ""}
            onChange={(e) => setFilter("priority", e.target.value ? Number(e.target.value) : 0)}
          >
            <option value="">Все приоритеты</option>
            {PRIORITY_LEVELS.map((p) => (
              <option key={p} value={p}>
                {"★".repeat(p)}
              </option>
            ))}
          </select>

          <select
            className={primitives.select}
            value={filters.coordinator}
            onChange={(e) => setFilter("coordinator", e.target.value)}
          >
            <option value="">Все координаторы</option>
            {coordinatorOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Сбросить
          </Button>
          <div className={primitives.spacer} />
          <Button variant="primary" size="sm" onClick={() => setModalOpen(true)}>
            <Icon name="plus" size={14} />
            Добавить адрес
          </Button>
        </div>

        {addressesLoading && <SkeletonRows rows={9} />}
        {!addressesLoading && addressesError && <ErrorState onRetry={refreshAddresses} />}
        {!addressesLoading &&
          !addressesError &&
          (visibleRows.length === 0 ? (
            <EmptyState
              title={showArchived ? "В архиве пусто" : "Адреса не найдены"}
              text="Измените условия поиска, сбросьте фильтры или добавьте первый адрес."
              onReset={resetFilters}
            />
          ) : (
            <AddressesTable rows={visibleRows} onRowClick={openAddressDrawer} />
          ))}
      </Panel>

      {modalOpen && <AddAddressModal onClose={() => setModalOpen(false)} onSubmit={addAddress} />}
    </>
  );
}
