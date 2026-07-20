"use client";

import { usePortal } from "@/components/portal/context/PortalContext";
import { Icon, type IconName } from "@/components/portal/ui/Icon";
import { PageHead } from "@/components/portal/ui/PageHead";
import { Panel, PanelHead, PanelHeadSub } from "@/components/portal/ui/Panel";
import { StatCard } from "@/components/portal/ui/StatCard";
import { fmtMoney, relativeTime } from "@/lib/portal/format";
import { NOTIF_TYPE_LABELS } from "@/lib/portal/notifications";
import primitives from "@/components/portal/ui/primitives.module.css";
import styles from "./OverviewSection.module.css";

interface RiskItem {
  name: string;
  detail: string;
  num: string;
  level: "critical" | "elevated";
}

const RISKS: RiskItem[] = [
  { name: "X5 Group — Уфа", detail: "9 из 12 позиций не закрыто", num: "−9", level: "critical" },
  { name: "Купер — Новосибирск", detail: "Факт выходов ниже плана на 41%", num: "−41%", level: "critical" },
  { name: "X5 Group — Казань", detail: "Отставание от плана", num: "−14%", level: "elevated" },
  { name: "Яндекс Лавка — СПб", detail: "Рост стоимости отклика", num: "+18%", level: "elevated" },
];

interface Stat {
  icon: IconName;
  value: string | number;
  label: string;
  delta: string;
  tone: "up" | "down" | "flat";
}

export function OverviewSection() {
  const { candidates, notifications } = usePortal();

  const stats: Stat[] = [
    { icon: "building", value: 6, label: "Активные проекты", delta: "+1 за месяц", tone: "up" },
    { icon: "target", value: 214, label: "Общая потребность", delta: "на ближайшие 30 дней", tone: "flat" },
    { icon: "users", value: candidates.length, label: "Кандидаты в работе", delta: "+12% за неделю", tone: "up" },
    { icon: "clock", value: 168, label: "Запланировано выходов", delta: "на этой неделе", tone: "flat" },
    { icon: "check", value: 141, label: "Фактические выходы", delta: "84% от плана", tone: "down" },
    { icon: "alert", value: 27, label: "Дефицит персонала", delta: "требует внимания", tone: "down" },
    { icon: "bar", value: "84%", label: "Выполнение плана", delta: "−6 п.п. к цели", tone: "down" },
    { icon: "trend", value: fmtMoney(3260), label: "Стоимость привлечения", delta: "−4% за месяц", tone: "up" },
  ];

  return (
    <>
      <PageHead eyebrow="Понедельник, 20 июля 2026">
        Сводка по всем проектам подбора и аутсорсинга линейного персонала за текущий период.
      </PageHead>

      <div className={primitives.statGrid}>
        {stats.map((s) => (
          <StatCard key={s.label} icon={s.icon} value={s.value} label={s.label} delta={s.delta} deltaTone={s.tone} />
        ))}
      </div>

      <div className={primitives.grid2}>
        <Panel>
          <PanelHead>
            <h3>Проекты в зоне риска</h3>
            <PanelHeadSub>Требуют внимания</PanelHeadSub>
          </PanelHead>
          <div>
            {RISKS.map((r) => (
              <div className={styles.riskRow} key={r.name}>
                <span className={`${styles.riskDot} ${r.level === "critical" ? styles.riskDotCritical : styles.riskDotElevated}`} />
                <div className={styles.riskMain}>
                  <b>{r.name}</b>
                  <span>{r.detail}</span>
                </div>
                <span className={styles.riskNum}>{r.num}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <PanelHead>
            <h3>Важные уведомления</h3>
            <PanelHeadSub>За сегодня</PanelHeadSub>
          </PanelHead>
          <div>
            {notifications.slice(0, 4).map((n) => {
              const meta = NOTIF_TYPE_LABELS[n.type];
              const icoClass =
                n.type === "critical" ? styles.notifIcoCritical : n.type === "important" ? styles.notifIcoImportant : styles.notifIcoInfo;
              return (
                <div className={styles.notifRow} key={n.id}>
                  <div className={`${styles.notifIco} ${icoClass}`}>
                    <Icon name={meta.icon as "alert" | "bell" | "info"} size={14} />
                  </div>
                  <div className={styles.notifMain}>
                    <b>{n.title}</b>
                    <p>{n.text}</p>
                  </div>
                  <span className={styles.notifTime}>{relativeTime(n.minsAgo)}</span>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </>
  );
}
