import { PROJECTS } from "./constants";
import { TODAY, addDays } from "./format";
import { createRng, randInt } from "./random";
import type { DemandDay, DemandLevel, DemandMatrix } from "./types";

export const DEMAND_START = addDays(TODAY, -14);
export const DEMAND_DAYS = 60;

export function generateDemand(): DemandMatrix {
  const rnd = createRng(20260721);
  const matrix: DemandMatrix = {};

  for (const project of PROJECTS) {
    matrix[project.id] = {};
    for (const city of project.cities) {
      const days: DemandDay[] = [];
      for (let i = 0; i < DEMAND_DAYS; i++) {
        const date = addDays(DEMAND_START, i);
        const roll = rnd();
        let level: DemandLevel;
        let need: number;
        if (roll < 0.18) {
          level = "zero";
          need = 0;
        } else if (roll < 0.6) {
          level = "normal";
          need = randInt(rnd, 1, 4);
        } else if (roll < 0.84) {
          level = "elevated";
          need = randInt(rnd, 5, 9);
        } else {
          level = "critical";
          need = randInt(rnd, 10, 18);
        }
        days.push({ date, need, level });
      }
      matrix[project.id][city] = days;
    }
  }

  return matrix;
}

export interface DemandColumn {
  key: number;
  label: string;
  sub: string;
  from: number;
  span: number;
  weekend: boolean;
}

export function levelForNeed(need: number, hasCritical: boolean, hasElevated: boolean): DemandLevel {
  if (need === 0) return "zero";
  if (hasCritical) return "critical";
  if (hasElevated) return "elevated";
  return "normal";
}

export type DemandScale = "day" | "week" | "month";

export function getScaleColumns(scale: DemandScale): DemandColumn[] {
  if (scale === "day") {
    const cols: DemandColumn[] = [];
    for (let i = 0; i < 45; i++) {
      const date = addDays(DEMAND_START, i);
      const weekend = date.getDay() === 0 || date.getDay() === 6;
      cols.push({
        key: i,
        label: date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }),
        sub: ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"][date.getDay()],
        from: i,
        span: 1,
        weekend,
      });
    }
    return cols;
  }
  if (scale === "week") {
    const cols: DemandColumn[] = [];
    const weeks = Math.ceil(DEMAND_DAYS / 7);
    for (let i = 0; i < weeks; i++) {
      const from = addDays(DEMAND_START, i * 7);
      const to = addDays(DEMAND_START, Math.min(i * 7 + 6, DEMAND_DAYS - 1));
      const fmt = (d: Date) => d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
      cols.push({ key: i, label: `Нед ${i + 1}`, sub: `${fmt(from)}–${fmt(to)}`, from: i * 7, span: 7, weekend: false });
    }
    return cols;
  }
  return [
    { key: 0, label: "Июль", sub: "2026", from: 0, span: 31, weekend: false },
    { key: 1, label: "Август", sub: "2026", from: 31, span: 31, weekend: false },
  ];
}

export function aggregateCell(days: DemandDay[], from: number, span: number): { need: number; level: DemandLevel } {
  const slice = days.slice(from, Math.min(from + span, days.length));
  if (!slice.length) return { need: 0, level: "zero" };
  const need = slice.reduce((sum, d) => sum + d.need, 0);
  const hasCritical = slice.some((d) => d.level === "critical");
  const hasElevated = slice.some((d) => d.level === "elevated");
  return { need, level: levelForNeed(need, hasCritical, hasElevated) };
}
