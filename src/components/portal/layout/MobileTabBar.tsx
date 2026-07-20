"use client";

import { usePortal } from "@/components/portal/context/PortalContext";
import { NAV_ITEMS } from "@/lib/portal/constants";
import { Icon } from "@/components/portal/ui/Icon";
import styles from "./MobileTabBar.module.css";

const MOBILE_ITEMS = [NAV_ITEMS[0], NAV_ITEMS[1], NAV_ITEMS[2], NAV_ITEMS[4], NAV_ITEMS[6]];

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
