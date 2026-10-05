import { StatCard } from "@/components/portal/ui/StatCard";
import type { AddressMetrics } from "./addressMetrics";
import styles from "./AddressesSection.module.css";

export function AddressesDashboard({ stats }: { stats: AddressMetrics }) {
  return (
    <div className={styles.statGrid3}>
      <StatCard icon="mapPin" value={stats.withDemand.toLocaleString("ru-RU")} label="Адресов с потребностью" />
      <StatCard icon="check" value={stats.active.toLocaleString("ru-RU")} label="Активных адресов" />
      <StatCard icon="box" value={stats.archived.toLocaleString("ru-RU")} label="Архивных адресов" />
    </div>
  );
}
