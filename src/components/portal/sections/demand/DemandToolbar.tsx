"use client";

import { Button } from "@/components/portal/ui/Button";
import { Icon } from "@/components/portal/ui/Icon";
import { CANDIDATE_PROJECTS } from "@/lib/portal/candidateOptions";
import primitives from "@/components/portal/ui/primitives.module.css";

export function DemandToolbar({
  search,
  onSearchChange,
  project,
  onProjectChange,
  city,
  onCityChange,
  cityOptions,
  onReset,
  onAdd,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  project: string;
  onProjectChange: (value: string) => void;
  city: string;
  onCityChange: (value: string) => void;
  cityOptions: string[];
  onReset: () => void;
  onAdd: () => void;
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
      <Button variant="ghost" size="sm" onClick={onReset}>
        Сбросить
      </Button>
      <div className={primitives.spacer} />
      <Button variant="primary" size="sm" onClick={onAdd}>
        <Icon name="plus" size={14} />
        Добавить потребность
      </Button>
    </div>
  );
}
