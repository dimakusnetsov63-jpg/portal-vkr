export const TODAY = new Date(2026, 6, 20);

export function addDays(date: Date, n: number): Date {
  const r = new Date(date);
  r.setDate(r.getDate() + n);
  return r;
}

export function fmtDate(d: Date): string {
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
}

export function fmtDateTime(d: Date | null): string | null {
  if (!d) return null;
  return (
    d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }) +
    ", " +
    d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
  );
}

export function fmtMoney(n: number): string {
  return n.toLocaleString("ru-RU") + " ₽";
}

export const WEEKDAY_SHORT = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

export function relativeTime(minsAgo: number): string {
  if (minsAgo < 60) return `${minsAgo} мин назад`;
  if (minsAgo < 60 * 24) return `${Math.floor(minsAgo / 60)} ч назад`;
  return `${Math.floor(minsAgo / (60 * 24))} дн назад`;
}

/**
 * Relative time from an ISO timestamp, for table cells ("Обновлено …") —
 * unlike `relativeTime` above (which takes a pre-computed minute count for
 * mock data), this works from a real `updated_at` and special-cases
 * "вчера" for exactly one day ago instead of "1 дн назад". Pair with
 * `fmtDateTime(new Date(iso))` for a full-date tooltip.
 */
export function formatRelativeUpdatedAt(iso: string): string {
  const then = new Date(iso).getTime();
  const minsAgo = Math.max(0, Math.floor((Date.now() - then) / 60000));
  if (minsAgo < 1) return "только что";
  if (minsAgo < 60) return `${minsAgo} мин назад`;
  if (minsAgo < 60 * 24) return `${Math.floor(minsAgo / 60)} ч назад`;
  const daysAgo = Math.floor(minsAgo / (60 * 24));
  if (daysAgo === 1) return "вчера";
  return `${daysAgo} дн назад`;
}

export function initials(fio: string): string {
  return fio
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
}

const AVATAR_COLORS = [
  "#0071e3",
  "#7C5CFC",
  "#12A150",
  "#E0A100",
  "#d33a2c",
  "#0f8b8d",
  "#5856d6",
  "#ff6b4a",
];

export function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = seed.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
