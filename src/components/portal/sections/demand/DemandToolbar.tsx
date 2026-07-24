"use client";

import { Button } from "@/components/portal/ui/Button";
import { Icon } from "@/components/portal/ui/Icon";
import { CANDIDATE_PROJECTS } from "@/lib/portal/candidateOptions";
import { DEMAND_ROW_STATUSES, DEMAND_ROW_STATUS_LABELS, type DemandRowStatus } from "./demandRowMeta";
import primitives from "@/components/portal/ui/primitives.module.css";
import styles from "./DemandSection.module.css";

export function DemandToolbar({
  search,
  onSearchChange,
  project,
  onProjectChange,
  city,
  onCityChange,
  cityOptions,
  filledOnly,
  onFilledOnlyChange,
  rowStatus,
  onRowStatusChange,
  onReset,
  onAdd,
  onToday,
  onPrevWeek,
  onCurrentWeek,
  onNextWeek,
  onExpandAll,
  onCollapseAll,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  project: string;
  onProjectChange: (value: string) => void;
  city: string;
  onCityChange: (value: string) => void;
  cityOptions: string[];
  filledOnly: boolean;
  onFilledOnlyChange: (value: boolean) => void;
  rowStatus: DemandRowStatus | "";
  onRowStatusChange: (value: DemandRowStatus | "") => void;
  onReset: () => void;
  onAdd: () => void;
  onToday: () => void;
  onPrevWeek: () => void;
  onCurrentWeek: () => void;
  onNextWeek: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}) {
  return (
    <div className={primitives.toolbar}>
      <div className={primitives.searchField} style={{ minWidth: 200 }}>
        <Icon name="search" size={15} />
        <input
          type="text"
          placeholder="Поиск по проекту или городу"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <select className={primitives.select} value={project} onChange={(e) => onProjectChange(e.target.value)}>
        <option value="">Все проекты</option>
        {CANDIDATE_PROJECTS.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      <select className={primitives.select} value={city} onChange={(e) => onCityChange(e.target.value)}>
        <option value="">Все города</option>
        {cityOptions.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <select
        className={primitives.select}
        value={rowStatus}
        onChange={(e) => onRowStatusChange(e.target.value as DemandRowStatus | "")}
      >
        <option value="">Все статусы</option>
        {DEMAND_ROW_STATUSES.map((s) => (
          <option key={s} value={s}>
            {DEMAND_ROW_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      <label className={styles.filledToggle}>
        <input type="checkbox" checked={filledOnly} onChange={(e) => onFilledOnlyChange(e.target.checked)} />
        Только заполненные
      </label>
      <Button variant="ghost" size="sm" onClick={onReset}>
        Сбросить
      </Button>

      <div className={primitives.spacer} />

      <Button variant="ghost" size="sm" onClick={onExpandAll}>
        Развернуть все
      </Button>
      <Button variant="ghost" size="sm" onClick={onCollapseAll}>
        Свернуть все
      </Button>

      <div className={primitives.seg}>
        <button type="button" className={primitives.segButton} onClick={onPrevWeek}>
          ← Неделя
        </button>
        <button type="button" className={primitives.segButton} onClick={onCurrentWeek}>
          Текущая
        </button>
        <button type="button" className={primitives.segButton} onClick={onNextWeek}>
          Неделя →
        </button>
      </div>
      <Button variant="ghost" size="sm" onClick={onToday}>
        Сегодня
      </Button>

      <Button variant="primary" size="sm" onClick={onAdd}>
        <Icon name="plus" size={14} />
        Добавить потребность
      </Button>
    </div>
  );
}
