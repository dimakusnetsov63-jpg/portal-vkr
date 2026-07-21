"use client";

import { useMemo, useState } from "react";
import { Icon, type IconName } from "@/components/portal/ui/Icon";
import { Badge } from "@/components/portal/ui/Badge";
import { PageHead } from "@/components/portal/ui/PageHead";
import { EmptyState } from "@/components/portal/ui/StateViews";
import {
  VACANCY_PROJECTS,
  VACANCY_CATEGORY_LABELS,
  type VacancyCategory,
  type VacancyProject,
} from "@/lib/portal/vacancyData";
import type { BadgeColor } from "@/lib/portal/types";
import primitives from "@/components/portal/ui/primitives.module.css";
import styles from "./VacanciesSection.module.css";

const CATEGORY_ORDER: VacancyCategory[] = [
  "courier",
  "warehouse",
  "logistics",
  "retail",
  "production",
  "support",
  "reference",
];

const CATEGORY_BADGE: Record<VacancyCategory, BadgeColor> = {
  courier: "blue",
  warehouse: "violet",
  logistics: "teal",
  retail: "amber",
  production: "green",
  support: "gray",
  reference: "red",
};

function iconForLabel(label: string): IconName {
  const l = label.toLowerCase();
  if (!l) return "info";
  if (l.includes("оформ")) return "file";
  if (l.includes("график") || l.includes("время работ") || l.includes("рабочее мест")) return "clock";
  if (l.includes("дата начала") || l.includes("период работ")) return "calendar";
  if (l.includes("оплат") || l.includes("выплат") || l.includes("ставк") || l.includes("зарплат")) return "cash";
  if (l.includes("интервью") || l.includes("собеседован")) return "check";
  if (l.includes("треб") || l.includes("возраст") || l.includes("гражданств")) return "shield";
  if (l.includes("мед")) return "heart";
  if (l.includes("обязан")) return "target";
  if (l.includes("профиль")) return "users";
  if (l.includes("стажир") || l.includes("обучен")) return "graduation";
  if (l.includes("преимущ") || l.includes("бонус")) return "gift";
  if (l.includes("регион") || l.includes("адрес") || l.includes("гео") || l.includes("радиус") || l.includes("расстоян"))
    return "mapPin";
  if (l.includes("инвентар") || l.includes("выдач") || l.includes("аренд") || l.includes("объем") || l.includes("вес"))
    return "box";
  return "info";
}

export function VacanciesSection() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<VacancyCategory | "">("");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(VACANCY_PROJECTS[0]?.slug ?? null);

  const counts = useMemo(() => {
    const map: Partial<Record<VacancyCategory, number>> = {};
    for (const p of VACANCY_PROJECTS) map[p.category] = (map[p.category] ?? 0) + 1;
    return map;
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return VACANCY_PROJECTS.filter((p) => {
      if (category && p.category !== category) return false;
      if (!q) return true;
      if (p.title.toLowerCase().includes(q) || p.subtitle.toLowerCase().includes(q)) return true;
      return p.sections.some(
        (s) => s.label.toLowerCase().includes(q) || s.values.some((v) => v.toLowerCase().includes(q)),
      );
    });
  }, [search, category]);

  const selected: VacancyProject | null = useMemo(() => {
    const found = filtered.find((p) => p.slug === selectedSlug);
    return found ?? filtered[0] ?? null;
  }, [filtered, selectedSlug]);

  const selectedIndex = selected ? filtered.findIndex((p) => p.slug === selected.slug) : -1;

  function resetFilters() {
    setSearch("");
    setCategory("");
  }

  function goRelative(delta: number) {
    if (filtered.length === 0) return;
    const idx = selectedIndex < 0 ? 0 : selectedIndex;
    const next = (idx + delta + filtered.length) % filtered.length;
    setSelectedSlug(filtered[next].slug);
  }

  return (
    <>
      <PageHead eyebrow="Справочник по проектам">
        Описание вакансий по всем проектам подбора — график, оплата, требования и условия работы, собранные в одном
        месте.
      </PageHead>

      <div className={styles.layout}>
        <div className={`${primitives.panel} ${styles.listPanel}`}>
          <div className={styles.toolbar}>
            <div className={`${primitives.searchField} ${styles.searchFieldFull}`}>
              <Icon name="search" size={15} />
              <input
                type="text"
                placeholder="Поиск по проекту, должности, условиям…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.chips}>
            <button className={`${styles.chip} ${category === "" ? styles.chipActive : ""}`} onClick={() => setCategory("")}>
              Все <span className={styles.chipCount}>{VACANCY_PROJECTS.length}</span>
            </button>
            {CATEGORY_ORDER.map((c) => (
              <button
                key={c}
                className={`${styles.chip} ${category === c ? styles.chipActive : ""}`}
                onClick={() => setCategory(c)}
              >
                {VACANCY_CATEGORY_LABELS[c]} <span className={styles.chipCount}>{counts[c] ?? 0}</span>
              </button>
            ))}
          </div>

          <div className={styles.list}>
            {filtered.length === 0 && (
              <EmptyState
                title="Ничего не найдено"
                text="Попробуйте изменить запрос или сбросить фильтр."
                onReset={resetFilters}
              />
            )}
            {filtered.map((p) => (
              <button
                key={p.slug}
                className={`${styles.listItem} ${selected?.slug === p.slug ? styles.listItemActive : ""}`}
                onClick={() => setSelectedSlug(p.slug)}
              >
                <div className={styles.listItemTop}>
                  <span className={styles.listItemTitle}>{p.title}</span>
                  <Icon name="chevron" size={14} />
                </div>
                <p className={styles.listItemSub}>{p.subtitle}</p>
                <Badge color={CATEGORY_BADGE[p.category]}>{VACANCY_CATEGORY_LABELS[p.category]}</Badge>
              </button>
            ))}
          </div>
        </div>

        <div className={`${primitives.panel} ${styles.detailPanel}`}>
          {selected ? (
            <VacancyDetail
              project={selected}
              index={selectedIndex}
              total={filtered.length}
              onPrev={() => goRelative(-1)}
              onNext={() => goRelative(1)}
            />
          ) : (
            <EmptyState title="Выберите проект" text="Список слева — кликните по карточке, чтобы увидеть условия." />
          )}
        </div>
      </div>
    </>
  );
}

function VacancyDetail({
  project,
  index,
  total,
  onPrev,
  onNext,
}: {
  project: VacancyProject;
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <>
      <div className={styles.detailHead}>
        <div>
          <div className={styles.detailEyebrow}>
            <Badge color={CATEGORY_BADGE[project.category]}>{VACANCY_CATEGORY_LABELS[project.category]}</Badge>
            <span className={styles.detailSource}>Источник: {project.sourceSheet.trim()}</span>
          </div>
          <h3 className={styles.detailTitle}>{project.title}</h3>
          <p className={styles.detailSubtitle}>{project.subtitle}</p>
        </div>
        <div className={styles.pager}>
          <button className={styles.pagerBtn} onClick={onPrev} aria-label="Предыдущий проект" disabled={total <= 1}>
            <Icon name="chevron" size={16} />
          </button>
          <span className={styles.pagerCount}>{total === 0 ? "0 / 0" : `${index + 1} / ${total}`}</span>
          <button
            className={`${styles.pagerBtn} ${styles.pagerBtnNext}`}
            onClick={onNext}
            aria-label="Следующий проект"
            disabled={total <= 1}
          >
            <Icon name="chevron" size={16} />
          </button>
        </div>
      </div>

      <div className={styles.blockGrid}>
        {project.sections.map((section, i) => (
          <div key={i} className={styles.block}>
            <div className={styles.blockHead}>
              <span className={styles.blockIco}>
                <Icon name={iconForLabel(section.label)} size={15} />
              </span>
              {section.label && <span className={styles.blockLabel}>{section.label}</span>}
            </div>
            {section.values.length > 1 ? (
              <ul className={styles.blockList}>
                {section.values.map((v, vi) => (
                  <li key={vi}>{v}</li>
                ))}
              </ul>
            ) : (
              <p className={styles.blockText}>{section.values[0]}</p>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
