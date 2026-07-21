"use client";

import { usePortal } from "@/components/portal/context/PortalContext";
import { NAV_ITEMS } from "@/lib/portal/constants";
import { Icon } from "@/components/portal/ui/Icon";
import type { PortalPage } from "@/lib/portal/types";
import styles from "./MobileTabBar.module.css";

const MOBILE_ITEM_IDS: PortalPage[] = ["overview", "demand", "candidates", "analytics", "settings"];
const MOBILE_ITEMS = MOBILE_ITEM_IDS.map((id) => NAV_ITEMS.find((item) => item.id === id)!);

export function MobileTabBar() {
  const { activePage, goto } = usePortal();
  return (
    <nav className={styles.tabbar}>
      {MOBILE_ITEMS.map((item) => (
        <button
          key={item.id}
          className={activePage === item.id ? styles.tabbarButtonActive : ""}
          onClick={() => goto(item.id)}
        >
          <Icon name={item.icon} size={19} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
