"use client";

import { useState } from "react";
import { usePortal } from "@/components/portal/context/PortalContext";
import { PageHead } from "@/components/portal/ui/PageHead";
import { Panel } from "@/components/portal/ui/Panel";
import { NoDataState } from "@/components/portal/ui/StateViews";
import { PROJECTS } from "@/lib/portal/constants";
import primitives from "@/components/portal/ui/primitives.module.css";
import { ChannelsTab, FunnelTab, PlanFactTab, ProjectsTab, RecruitersTab } from "./AnalyticsTabs";

type Tab = "projects" | "recruiters" | "channels" | "planfact" | "funnel";
type Period = "week" | "month" | "quarter" | "q1-2023";

const TABS: { value: Tab; label: string }[] = [
  { value: "projects", label: "Проекты и города" },
  { value: "recruiters", label: "Рекрутеры" },
  { value: "channels", label: "Каналы" },
  { value: "planfact", label: "План / Факт" },
  { value: "funnel", label: "Воронка и прогноз" },
];

export function AnalyticsSection() {
  const { candidates } = usePortal();
  const [tab, setTab] = useState<Tab>("projects");
  const [period, setPeriod] = useState<Period>("month");
  const [project, setProject] = useState("");

  return (
    <>
      <PageHead eyebrow="Отчётность">Показатели плана, дефицита и конверсии воронки найма по срезам.</PageHead>

      <Panel style={{ marginBottom: 16 }}>
        <div className={primitives.toolbar}>
          <select className={primitives.select} value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
            <option value="week">Текущая неделя</option>
            <option value="month">Текущий месяц</option>
            <option value="quarter">Текущий квартал</option>
            <option value="q1-2023">Q1 2023 (архив)</option>
          </select>
          <select className={primitives.select} value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="">Все проекты</option>
            {PROJECTS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <div className={primitives.spacer} />
          <div className={primitives.pillTabs} style={{ padding: 0 }}>
            {TABS.map((t) => (
              <button
                key={t.value}
                className={`${primitives.pillTabButton} ${tab === t.value ? primitives.pillTabButtonActive : ""}`}
                onClick={() => setTab(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </Panel>

      <Panel>
        {period === "q1-2023" ? (
          <NoDataState
            title="Нет данных за выбранный период"
            text="Портал ведёт учёт с февраля 2026 года. Выберите другой период."
          />
        ) : (
          <>
            {tab === "projects" && <ProjectsTab />}
            {tab === "recruiters" && <RecruitersTab candidates={candidates} />}
            {tab === "channels" && <ChannelsTab />}
            {tab === "planfact" && <PlanFactTab />}
            {tab === "funnel" && <FunnelTab candidates={candidates} />}
          </>
        )}
      </Panel>
    </>
  );
}
