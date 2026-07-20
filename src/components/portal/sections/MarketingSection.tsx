"use client";

import { Badge } from "@/components/portal/ui/Badge";
import { PageHead } from "@/components/portal/ui/PageHead";
import { Panel, PanelBody, PanelHead, PanelHeadSub } from "@/components/portal/ui/Panel";
import { StatCard } from "@/components/portal/ui/StatCard";
import { CHANNELS } from "@/lib/portal/constants";
import { fmtMoney } from "@/lib/portal/format";
import primitives from "@/components/portal/ui/primitives.module.css";
import styles from "./MarketingSection.module.css";

export function MarketingSection() {
  const totals = CHANNELS.reduce(
    (acc, c) => ({
      budget: acc.budget + c.budget,
      responses: acc.responses + c.responses,
      shifts: acc.shifts + c.shifts,
    }),
    { budget: 0, responses: 0, shifts: 0 },
  );
  const costPerResponse = Math.round(totals.budget / totals.responses);
  const costPerHire = Math.round(totals.budget / totals.shifts);

  const sortedByBudget = [...CHANNELS].sort((a, b) => b.budget - a.budget);
  const maxBudget = sortedByBudget[0]?.budget ?? 1;

  return (
    <>
      <PageHead eyebrow="Привлечение">
        Эффективность рекламных каналов и стоимость привлечения по воронке найма.
      </PageHead>

      <div className={primitives.statGrid}>
        <StatCard icon="trend" value={fmtMoney(totals.budget)} label="Бюджет за 30 дней" />
        <StatCard icon="users" value={totals.responses.toLocaleString("ru-RU")} label="Всего откликов" />
        <StatCard icon="target" value={fmtMoney(costPerResponse)} label="Стоимость отклика" />
        <StatCard icon="check" value={fmtMoney(costPerHire)} label="Стоимость 1 выхода" />
      </div>

      <div className={primitives.grid2}>
        <Panel>
          <PanelHead>
            <h3>Каналы привлечения</h3>
            <PanelHeadSub>За последние 30 дней</PanelHeadSub>
          </PanelHead>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Канал</th>
                  <th>Бюджет</th>
                  <th>Отклики</th>
                  <th>Cost/отклик</th>
                  <th>Приглашения</th>
                  <th>Оформления</th>
                  <th>Выходы</th>
                  <th>Cost/выход</th>
                  <th>Конверсия</th>
                </tr>
              </thead>
              <tbody>
                {CHANNELS.map((ch) => {
                  const cpl = Math.round(ch.budget / ch.responses);
                  const cph = Math.round(ch.budget / ch.shifts);
                  const conv = Math.round((ch.shifts / ch.responses) * 100);
                  return (
                    <tr key={ch.name}>
                      <td className={styles.channelName}>{ch.name}</td>
                      <td>{fmtMoney(ch.budget)}</td>
                      <td>{ch.responses}</td>
                      <td className={primitives.muted}>{fmtMoney(cpl)}</td>
                      <td>{ch.invites}</td>
                      <td>{ch.processed}</td>
                      <td>{ch.shifts}</td>
                      <td className={primitives.muted}>{fmtMoney(cph)}</td>
                      <td>
                        <Badge color={conv >= 20 ? "green" : conv >= 12 ? "amber" : "red"}>{conv}%</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel>
          <PanelHead>
            <h3>Доля бюджета по каналам</h3>
          </PanelHead>
          <PanelBody>
            {sortedByBudget.map((ch) => (
              <div className={styles.channelRow} key={ch.name}>
                <span className={styles.channelLabel}>{ch.name}</span>
                <div className={primitives.barTrack}>
                  <div className={primitives.barFill} style={{ width: `${(ch.budget / maxBudget) * 100}%` }} />
                </div>
                <span className={`${styles.channelValue} ${primitives.mono}`}>{fmtMoney(ch.budget)}</span>
              </div>
            ))}
          </PanelBody>
        </Panel>
      </div>
    </>
  );
}
