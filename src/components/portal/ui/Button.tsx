import type { ButtonHTMLAttributes } from "react";
import styles from "./primitives.module.css";

type Variant = "default" | "primary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /**
   * Destructive tone. Kept as a separate flag rather than folded into
   * `variant` because it combines with the others: `danger` alone is a quiet
   * red-on-white button, `variant="primary" danger` is the solid red confirm.
   */
  danger?: boolean;
  /** Square icon-only button — no label, no horizontal padding. */
  icon?: boolean;
}

const VARIANT_CLASS: Record<Variant, string> = {
  default: styles.btn,
  primary: `${styles.btn} ${styles.btnPrimary}`,
  ghost: `${styles.btn} ${styles.btnGhost}`,
  danger: `${styles.btn} ${styles.btnDanger}`,
};

const SIZE_CLASS: Record<Size, string> = {
  sm: styles.btnSm,
  md: "",
  lg: styles.btnLg,
};

export function Button({
  variant = "default",
  size = "md",
  danger,
  icon,
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  const classes = [
    VARIANT_CLASS[variant],
    SIZE_CLASS[size],
    danger ? styles.btnDanger : "",
    icon ? styles.btnSquare : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return <button type={type} className={classes} {...rest} />;
}
