import { StatCard } from "@/components/portal/ui/StatCard";
import type { AddressMetrics } from "./addressMetrics";
import styles from "./AddressesSection.module.css";

export function AddressesDashboard({ stats }: { stats: AddressMetrics }) {
  return (
    <div className={styles.statGrid8}>
      <StatCard icon="mapPin" value={stats.total.toLocaleString("ru-RU")} label="Всего адресов" />
      <StatCard icon="check" value={stats.active.toLocaleString("ru-RU")} label="Активных адресов" />
      <StatCard icon="box" value={stats.archived.toLocaleString("ru-RU")} label="Архивных адресов" />
      <StatCard icon="users" value={stats.totalDemand.toLocaleString("ru-RU")} label="Общая потребность" />
      <StatCard icon="briefcase" value={stats.closedPositions.toLocaleString("ru-RU")} label="Закрыто вакансий" />
      <StatCard icon="alert" value={stats.openDemand.toLocaleString("ru-RU")} label="Незакрытая потребность" />
      <StatCard icon="target" value={stats.criticalCount.toLocaleString("ru-RU")} label="Критичных адресов" />
      <StatCard icon="trend" value={`${stats.avgFillRatePct}%`} label="Средняя укомплектованность" />
    </div>
  );
}
