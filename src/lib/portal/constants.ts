import type { IconName } from "@/components/portal/ui/Icon";
import type { PortalPage } from "./types";

export interface NavItem {
  id: PortalPage;
  label: string;
  icon: IconName;
}

export const NAV_ITEMS: NavItem[] = [
  { id: "overview", label: "Обзор", icon: "home" },
  { id: "demand", label: "Потребность", icon: "grid" },
  { id: "addresses", label: "Адреса", icon: "mapPin" },
  { id: "candidates", label: "Кандидаты", icon: "users" },
  { id: "vacancies", label: "Описание вакансий", icon: "briefcase" },
  { id: "rates", label: "Ставки", icon: "cash" },
  { id: "quality", label: "Контроль качества", icon: "shield" },
  { id: "marketing", label: "Маркетинг", icon: "trend" },
  { id: "analytics", label: "Аналитика", icon: "bar" },
  { id: "notifications", label: "Уведомления", icon: "bell" },
  { id: "settings", label: "Настройки", icon: "gear" },
];

export const PAGE_TITLES: Record<PortalPage, string> = {
  overview: "Обзор",
  demand: "Потребность",
  addresses: "Адреса",
  candidates: "Кандидаты",
  vacancies: "Описание вакансий",
  rates: "Ставки",
  quality: "Контроль качества",
  marketing: "Маркетинг",
  analytics: "Аналитика",
  notifications: "Уведомления",
  settings: "Настройки",
};
