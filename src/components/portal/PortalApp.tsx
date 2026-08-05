"use client";

import { PortalProvider, usePortal } from "@/components/portal/context/PortalContext";
import { Sidebar } from "@/components/portal/layout/Sidebar";
import { Topbar } from "@/components/portal/layout/Topbar";
import { MobileTabBar } from "@/components/portal/layout/MobileTabBar";
import { ToastStack } from "@/components/portal/ui/ToastStack";
import { EmptyState } from "@/components/portal/ui/StateViews";
import { OverviewSection } from "@/components/portal/sections/OverviewSection";
import { DemandSection } from "@/components/portal/sections/demand";
import { AddressesSection, AddressDrawer } from "@/components/portal/sections/addresses";
import { CandidatesSection, RealCandidateDrawer } from "@/components/portal/sections/candidates";
import { VacanciesSection } from "@/components/portal/sections/vacancies";
import { RatesSection, RateDrawer } from "@/components/portal/sections/rates";
import { MarketingSection } from "@/components/portal/sections/MarketingSection";
import { AnalyticsSection } from "@/components/portal/sections/AnalyticsSection";
import { NotificationsSection } from "@/components/portal/sections/NotificationsSection";
import { SettingsSection } from "@/components/portal/sections/settings";
import type { PortalUser } from "@/lib/supabase/portalAuth.types";
import styles from "./PortalApp.module.css";

function ActiveSection() {
  const { activePage, can } = usePortal();

  // Последний рубеж в интерфейсе: меню недоступные разделы не показывает,
  // middleware не пускает по ссылке, но раздел не должен рендериться и в
  // том случае, если что-то в портале вызвало goto() в обход проверки.
  if (!can(activePage)) {
    return (
      <EmptyState
        title="Доступ запрещён"
        text="У вашей роли нет доступа к этому разделу. Права выдаёт руководитель в разделе «Настройки»."
      />
    );
  }

  switch (activePage) {
    case "overview":
      return <OverviewSection />;
    case "demand":
      return <DemandSection />;
    case "addresses":
      return <AddressesSection />;
    case "candidates":
      return <CandidatesSection />;
    case "vacancies":
      return <VacanciesSection />;
    case "rates":
      return <RatesSection />;
    case "marketing":
      return <MarketingSection />;
    case "analytics":
      return <AnalyticsSection />;
    case "notifications":
      return <NotificationsSection />;
    case "settings":
      return <SettingsSection />;
    default:
      return null;
  }
}

function PortalShell() {
  const { activePage, selectedRealCandidateId, selectedAddressId, selectedRateId } = usePortal();
  return (
    <div className={styles.app}>
      <Sidebar />
      <div className={styles.main}>
        <Topbar />
        <main className={styles.content} key={activePage}>
          <ActiveSection />
        </main>
      </div>
      <MobileTabBar />
      <RealCandidateDrawer candidateId={selectedRealCandidateId} />
      <AddressDrawer addressId={selectedAddressId} />
      <RateDrawer rateId={selectedRateId} />
      <ToastStack />
    </div>
  );
}

export function PortalApp({ initialUser }: { initialUser: PortalUser }) {
  return (
    <PortalProvider initialUser={initialUser}>
      <PortalShell />
    </PortalProvider>
  );
}
