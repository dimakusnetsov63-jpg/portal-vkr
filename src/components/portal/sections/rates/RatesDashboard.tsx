import { StatCard } from "@/components/portal/ui/StatCard";
import type { RateMetrics } from "./rateMetrics";
import styles from "./RatesSection.module.css";

export function RatesDashboard({ stats }: { stats: RateMetrics }) {
  return (
    <div className={styles.statGrid}>
      <StatCard icon="cash" value={stats.totalRates.toLocaleString("ru-RU")} label="Всего ставок" />
      <StatCard icon="grid" value={stats.totalCards.toLocaleString("ru-RU")} label="Блоков условий" />
      <StatCard icon="briefcase" value={stats.projectsCount.toLocaleString("ru-RU")} label="Проектов" />
      <StatCard icon="mapPin" value={stats.citiesCount.toLocaleString("ru-RU")} label="Городов" />
      <StatCard icon="users" value={stats.positionsCount.toLocaleString("ru-RU")} label="Должностей" />
      <StatCard icon="trend" value={`${stats.avgHourRate.toLocaleString("ru-RU")} ₽`} label="Средняя ставка за час" />
      <StatCard icon="clock" value={`${stats.avgShiftIncome.toLocaleString("ru-RU")} ₽`} label="Средний доход за смену" />
      <StatCard icon="bar" value={`${stats.avgMonthIncome.toLocaleString("ru-RU")} ₽`} label="Средний доход за месяц" />
    </div>
  );
}
