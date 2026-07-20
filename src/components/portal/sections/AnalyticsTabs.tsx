"use client";

import { useMemo } from "react";
import { Badge } from "@/components/portal/ui/Badge";
import { Icon } from "@/components/portal/ui/Icon";
import { PanelHead, PanelHeadSub } from "@/components/portal/ui/Panel";
import { CHANNELS, PROJECTS, RECRUITERS } from "@/lib/portal/constants";
import { fmtMoney } from "@/lib/portal/format";
import { generateDemand } from "@/lib/portal/generateDemand";
import { createRng, randInt } from "@/lib/portal/random";
import type { Candidate, StageId } from "@/lib/portal/types";
import primitives from "@/components/portal/ui/primitives.module.css";
import styles from "./AnalyticsSection.module.css";

function useProjectPlanFact() {
  return useMemo(() => {
    const demand = generateDemand();
    const rnd = createRng(20260723);
    return PROJECTS.map((project) => {
      let plan = 0;
      for (const city of project.cities) {
        plan += demand[project.id][city].slice(0, 30).reduce((sum, d) => sum + d.need, 0);
      }
      const fact = Math.round(plan * (0.6 + rnd() * 0.5));
      const pct = plan ? Math.round((fact / plan) * 100) : 0;
      return { project, plan, fact, pct };
    });
  }, []);
}

export function ProjectsTab() {
  const rows = useProjectPlanFact();
  return (
    <>
      <PanelHead>
        <h3>Выполнение плана по проектам</h3>
        <PanelHeadSub>30 дней</PanelHeadSub>
      </PanelHead>
      <div style={{ padding: 20 }}>
        {rows.map((r) => (
          <div className={`${primitives.barRow} ${primitives.barRowWide}`} key={r.project.id}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{r.project.name}</span>
            <div className={primitives.barTrack}>
              <div
                className={primitives.barFill}
                style={{
                  width: `${Math.min(r.pct, 100)}%`,
                  background: r.pct >= 100 ? "var(--green)" : r.pct >= 75 ? "var(--accent)" : "var(--red)",
                }}
              />
            </div>
            <span className={primitives.mono} style={{ fontSize: 12.5 }}>
              {r.fact} / {r.plan} · {r.pct}%
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

export function RecruitersTab({ candidates }: { candidates: Candidate[] }) {
  const rows = useMemo(() => {
    const processedStages: StageId[] = ["processing", "confirmed", "first_shift"];
    return RECRUITERS.map((r) => {
      const total = candidates.filter((c) => c.recruiter === r).length;
      const processed = candidates.filter((c) => c.recruiter === r && processedStages.includes(c.stage)).length;
      const conv = total ? Math.round((processed / total) * 100) : 0;
      return { recruiter: r, total, processed, conv };
    }).sort((a, b) => b.conv - a.conv);
  }, [candidates]);

  return (
    <>
      <PanelHead>
        <h3>Эффективность рекрутеров</h3>
      </PanelHead>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Рекрутер</th>
              <th>Передано кандидатов</th>
              <th>Оформлено</th>
              <th>Конверсия</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.recruiter}>
                <td className={styles.rowLabel}>{r.recruiter}</td>
                <td>{r.total}</td>
                <td>{r.processed}</td>
                <td>
                  <Badge color={r.conv >= 45 ? "green" : r.conv >= 25 ? "amber" : "red"}>{r.conv}%</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function ChannelsTab() {
  const total = CHANNELS.reduce((a, c) => a + c.shifts, 0);
  return (
    <>
      <PanelHead>
        <h3>Вклад каналов в фактический найм</h3>
      </PanelHead>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Канал</th>
              <th>Отклики</th>
              <th>Оформления</th>
              <th>Cost/выход</th>
              <th>Доля найма</th>
            </tr>
          </thead>
          <tbody>
            {CHANNELS.map((ch) => {
              const share = Math.round((ch.shifts / total) * 100);
              return (
                <tr key={ch.name}>
                  <td className={styles.rowLabel}>{ch.name}</td>
                  <td>{ch.responses}</td>
                  <td>{ch.processed}</td>
                  <td>{fmtMoney(Math.round(ch.budget / ch.shifts))}</td>
                  <td>
                    <div className={styles.shareCell}>
                      <div className={styles.shareTrack}>
                        <div className={styles.shareFill} style={{ width: `${share}%` }} />
                      </div>
                      <span className={primitives.mono} style={{ fontSize: 12 }}>
                        {share}%
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function PlanFactTab() {
  const rows = useProjectPlanFact();
  const allAtOrAboveTarget = rows.every((r) => r.pct >= 100);
  return (
    <>
      <PanelHead>
        <h3>План против факта</h3>
        <PanelHeadSub>По проектам, 30 дней</PanelHeadSub>
      </PanelHead>
      {allAtOrAboveTarget && (
        <div className={`${primitives.banner} ${primitives.bannerSuccess}`}>
          <Icon name="check" size={15} />
          Все проекты выполняют план на 100% и выше
        </div>
      )}
      <div className={primitives.kvList} style={{ padding: "0 20px 20px" }}>
        {rows.map((r) => (
          <div className={primitives.kvRow} key={r.project.id}>
            <span>{r.project.name}</span>
            <b style={{ color: r.pct >= 100 ? "var(--green)" : r.pct < 70 ? "var(--red)" : "var(--text-1)" }}>
              {r.fact} / {r.plan} ({r.pct}%)
            </b>
          </div>
        ))}
      </div>
    </>
  );
}

export function FunnelTab({ candidates }: { candidates: Candidate[] }) {
  const invitedStages: StageId[] = ["invited", "interview", "processing", "confirmed", "first_shift"];
  const interviewStages: StageId[] = ["interview", "processing", "confirmed", "first_shift"];
  const processedStages: StageId[] = ["processing", "confirmed", "first_shift"];

  const steps = [
    { name: "Отклик", value: candidates.length },
    { name: "Приглашён", value: candidates.filter((c) => invitedStages.includes(c.stage)).length },
    { name: "Собеседование", value: candidates.filter((c) => interviewStages.includes(c.stage)).length },
    { name: "Оформление", value: candidates.filter((c) => processedStages.includes(c.stage)).length },
    { name: "1-я смена", value: candidates.filter((c) => c.stage === "first_shift").length },
  ];
  const max = steps[0].value || 1;
  const forecast = useMemo(() => randInt(createRng(20260724), 74, 90), []);
  const circumference = 2 * Math.PI * 50;

  return (
    <>
      <PanelHead>
        <h3>Воронка найма и прогноз</h3>
        <PanelHeadSub>Текущий месяц</PanelHeadSub>
      </PanelHead>
      <div className={styles.funnelGrid}>
        <div>
          {steps.map((s, i) => {
            const pct = Math.round((s.value / max) * 100);
            const convPrev = i > 0 ? Math.round((s.value / (steps[i - 1].value || 1)) * 100) : 100;
            return (
              <div className={primitives.barRow} key={s.name}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</span>
                <div className={primitives.barTrack}>
                  <div className={primitives.barFill} style={{ width: `${pct}%` }} />
                </div>
                <span className={primitives.mono} style={{ fontSize: 12.5 }}>
                  {s.value}
                  {i > 0 ? ` · ${convPrev}%` : ""}
                </span>
              </div>
            );
          })}
        </div>
        <div className={styles.ringWrap}>
          <div className={styles.ring}>
            <svg width="118" height="118">
              <circle cx="59" cy="59" r="50" stroke="var(--gray-soft)" strokeWidth="10" fill="none" />
              <circle
                cx="59"
                cy="59"
                r="50"
                stroke="var(--accent)"
                strokeWidth="10"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - forecast / 100)}
              />
            </svg>
            <div className={styles.ringCenter}>
              <b>{forecast}%</b>
              <span>прогноз</span>
            </div>
          </div>
          <p className={styles.ringNote}>Прогноз выполнения плана к концу месяца при текущем темпе найма</p>
        </div>
      </div>
    </>
  );
}
