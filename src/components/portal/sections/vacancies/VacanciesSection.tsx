"use client";

import { useEffect, useMemo, useState } from "react";
import { usePortal } from "@/components/portal/context/PortalContext";
import { Icon } from "@/components/portal/ui/Icon";
import { Badge } from "@/components/portal/ui/Badge";
import { Button } from "@/components/portal/ui/Button";
import { PageHead } from "@/components/portal/ui/PageHead";
import { EmptyState, ErrorState, SkeletonLines } from "@/components/portal/ui/StateViews";
import { activeListOptions } from "@/lib/portal/candidateOptions";
import { searchVacancyProjects } from "@/lib/supabase/vacancyProjectsRepo";
import primitives from "@/components/portal/ui/primitives.module.css";
import styles from "./VacanciesSection.module.css";
import { AddVacancyProjectModal } from "./AddVacancyProjectModal";
import { VacancyDetail } from "./VacancyDetail";

/** Задержка перед серверным поиском по содержимому всех вакансий — локальная фильтрация по названию срабатывает мгновенно, без задержки. */
const SEARCH_DEBOUNCE_MS = 300;
const MIN_GLOBAL_SEARCH_LENGTH = 2;

export function VacanciesSection() {
  const {
    vacancyProjects,
    vacancyProjectsLoading,
    vacancyProjectsError,
    refreshVacancyProjects,
    addVacancyProject,
    selectedVacancyProjectId,
    openVacancyProjectDrawer,
    listOptions,
    canEdit,
  } = usePortal();

  // Право править содержимое вакансии. До фазы C оно выражалось связкой
  // «раздел vacancies + раздел settings» и здесь, и в политиках RLS; теперь
  // различие несёт сама матрица (can_edit у vacancies выключен у manager и
  // recruiter), поэтому спрашиваем прямо — см. docs/database/policies.md.
  const canEditVacancies = canEdit("vacancies");
  const [search, setSearch] = useState("");
  const [categoryOptionId, setCategoryOptionId] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [globalMatchIds, setGlobalMatchIds] = useState<string[] | null>(null);

  const categoryOptions = activeListOptions(listOptions, "vacancy_category");

  // Глобальный поиск по всему дереву (названия разделов, подписи и значения
  // полей) — отдельно от мгновенной локальной фильтрации по названию
  // вакансии ниже. Не дёргает сервер на каждый символ короче
  // MIN_GLOBAL_SEARCH_LENGTH и debounce'ится, чтобы не слать запрос на
  // каждое нажатие клавиши.
  useEffect(() => {
    const query = search.trim();
    let cancelled = false;
    const timeout = setTimeout(async () => {
      if (query.length < MIN_GLOBAL_SEARCH_LENGTH) {
        if (!cancelled) setGlobalMatchIds(null);
        return;
      }
      try {
        const ids = await searchVacancyProjects(query);
        if (!cancelled) setGlobalMatchIds(ids);
      } catch {
        if (!cancelled) setGlobalMatchIds(null);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [search]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vacancyProjects.filter((v) => {
      if (showArchived ? !v.archived_at : v.archived_at) return false;
      if (categoryOptionId && v.category_option_id !== categoryOptionId) return false;
      if (!q) return true;
      if (v.title.toLowerCase().includes(q)) return true;
      return globalMatchIds?.includes(v.id) ?? false;
    });
  }, [vacancyProjects, search, categoryOptionId, showArchived, globalMatchIds]);

  const selected = filtered.find((v) => v.id === selectedVacancyProjectId) ?? filtered[0] ?? null;

  function resetFilters() {
    setSearch("");
    setCategoryOptionId("");
  }

  return (
    <>
      <PageHead eyebrow="Справочник по проектам">
        Описание вакансий по всем проектам подбора — график, оплата, требования и условия работы, редактируется прямо
        в портале.
      </PageHead>

      <div className={styles.layout}>
        <div className={`${primitives.panel} ${styles.listPanel}`}>
          <div className={styles.toolbar}>
            <div className={`${primitives.searchField} ${styles.searchFieldFull}`}>
              <Icon name="search" size={16} />
              <input
                type="text"
                placeholder="Поиск по вакансии, разделу, полю…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {canEditVacancies && (
              <Button variant="primary" size="sm" onClick={() => setModalOpen(true)}>
                <Icon name="plus" size={14} />
                Добавить
              </Button>
            )}
          </div>

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

          <div className={styles.chips}>
            <button
              className={`${styles.chip} ${categoryOptionId === "" ? styles.chipActive : ""}`}
              onClick={() => setCategoryOptionId("")}
            >
              Все категории
            </button>
            {categoryOptions.map((o) => (
              <button
                key={o.id}
                className={`${styles.chip} ${categoryOptionId === o.id ? styles.chipActive : ""}`}
                onClick={() => setCategoryOptionId(o.id)}
              >
                {o.value}
              </button>
            ))}
          </div>

          <div className={styles.list}>
            {vacancyProjectsLoading && <SkeletonLines lines={6} />}
            {!vacancyProjectsLoading && vacancyProjectsError && <ErrorState onRetry={refreshVacancyProjects} />}
            {!vacancyProjectsLoading && !vacancyProjectsError && filtered.length === 0 && (
              <EmptyState
                title={showArchived ? "В архиве пусто" : "Ничего не найдено"}
                text="Попробуйте изменить запрос или сбросить фильтр."
                onReset={resetFilters}
              />
            )}
            {!vacancyProjectsLoading &&
              !vacancyProjectsError &&
              filtered.map((v) => (
                <button
                  key={v.id}
                  className={`${styles.listItem} ${selected?.id === v.id ? styles.listItemActive : ""}`}
                  onClick={() => openVacancyProjectDrawer(v.id)}
                >
                  <div className={styles.listItemTop}>
                    <span className={styles.listItemTitle}>{v.title}</span>
                    <Icon name="chevron" size={14} />
                  </div>
                  {v.category_option && <Badge color="blue">{v.category_option.value}</Badge>}
                </button>
              ))}
          </div>
        </div>

        <div className={`${primitives.panel} ${styles.detailPanel}`}>
          {selected ? (
            <VacancyDetail projectId={selected.id} canEdit={canEditVacancies} />
          ) : (
            <EmptyState
              title="Выберите вакансию"
              text="Список слева — кликните по карточке, чтобы увидеть описание."
            />
          )}
        </div>
      </div>

      {modalOpen && <AddVacancyProjectModal onClose={() => setModalOpen(false)} onSubmit={addVacancyProject} />}
    </>
  );
}
