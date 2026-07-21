"use client";

import { PortalProvider, usePortal } from "@/components/portal/context/PortalContext";
import { Sidebar } from "@/components/portal/layout/Sidebar";
import { Topbar } from "@/components/portal/layout/Topbar";
import { MobileTabBar } from "@/components/portal/layout/MobileTabBar";
import { ToastStack } from "@/components/portal/ui/ToastStack";
import { OverviewSection } from "@/components/portal/sections/OverviewSection";
import { DemandSection } from "@/components/portal/sections/DemandSection";
import { CandidatesSection } from "@/components/portal/sections/CandidatesSection";
import { CandidateDrawer } from "@/components/portal/sections/CandidateDrawer";
import { VacanciesSection } from "@/components/portal/sections/VacanciesSection";
import { MarketingSection } from "@/components/portal/sections/MarketingSection";
import { AnalyticsSection } from "@/components/portal/sections/AnalyticsSection";
import { NotificationsSection } from "@/components/portal/sections/NotificationsSection";
import { SettingsSection } from "@/components/portal/sections/SettingsSection";
import styles from "./PortalApp.module.css";

function ActiveSection() {
  const { activePage } = usePortal();
  switch (activePage) {
    case "overview":
      return <OverviewSection />;
    case "demand":
      return <DemandSection />;
    case "candidates":
      return <CandidatesSection />;
    case "vacancies":
      return <VacanciesSection />;
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
  const { activePage, selectedCandidateId } = usePortal();
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
      <CandidateDrawer candidateId={selectedCandidateId} />
      <ToastStack />
    </div>
  );
}

export function PortalApp() {
  return (
    <PortalProvider>
      <PortalShell />
    </PortalProvider>
  );
}
