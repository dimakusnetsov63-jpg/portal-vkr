import type { ButtonHTMLAttributes } from "react";
import styles from "./primitives.module.css";

type Variant = "default" | "primary" | "ghost";
type Size = "md" | "sm";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  danger?: boolean;
}

const VARIANT_CLASS: Record<Variant, string> = {
  default: styles.btn,
  primary: `${styles.btn} ${styles.btnPrimary}`,
  ghost: `${styles.btn} ${styles.btnGhost}`,
};

export function Button({
  variant = "default",
  size = "md",
  danger,
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  const classes = [
    VARIANT_CLASS[variant],
    size === "sm" ? styles.btnSm : "",
    danger ? styles.btnDanger : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return <button type={type} className={classes} {...rest} />;
}
