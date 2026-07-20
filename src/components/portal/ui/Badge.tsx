import type { BadgeColor } from "@/lib/portal/types";
import styles from "./primitives.module.css";

const COLOR_CLASS: Record<BadgeColor, string> = {
  blue: styles.badgeBlue,
  amber: styles.badgeAmber,
  violet: styles.badgeViolet,
  teal: styles.badgeTeal,
  green: styles.badgeGreen,
  red: styles.badgeRed,
  gray: styles.badgeGray,
};

export function Badge({ color, children }: { color: BadgeColor; children: React.ReactNode }) {
  return <span className={`${styles.badge} ${COLOR_CLASS[color]}`}>{children}</span>;
}
