import type { IconName } from "@/components/portal/ui/Icon";
import type { Channel, PortalPage, Project, Stage } from "./types";

export const PROJECTS: Project[] = [
  { id: "samokat", name: "Самокат", color: "#FF6B4A", cities: ["Москва", "Санкт-Петербург", "Казань"] },
  { id: "kuper", name: "Купер", color: "#7C5CFC", cities: ["Москва", "Санкт-Петербург", "Новосибирск"] },
  { id: "x5", name: "X5 Group", color: "#12A150", cities: ["Москва", "Казань", "Уфа", "Екатеринбург"] },
  { id: "ylavka", name: "Яндекс Лавка", color: "#E0B400", cities: ["Москва", "Санкт-Петербург"] },
  { id: "vkusvill", name: "ВкусВилл", color: "#2FAE60", cities: ["Москва", "Уфа"] },
  { id: "ozon", name: "Ozon Fresh", color: "#0064FF", cities: ["Санкт-Петербург", "Новосибирск", "Екатеринбург"] },
];

export const CITIES = ["Москва", "Санкт-Петербург", "Казань", "Уфа", "Новосибирск", "Екатеринбург"];

export const RECRUITERS = ["Елена Кравцова", "Никита Беляков", "Светлана Дорохова", "Павел Григорьев"];
export const MANAGERS = ["Антон Захаров", "Марина Волкова", "Андрей Котов", "Ирина Нестерова"];
export const COORDINATORS = ["Ольга Смирнова", "Максим Титов", "Юлия Фомина", "Дмитрий Волков"];

export const STAGES: Stage[] = [
  { id: "response", name: "Новый отклик", color: "blue" },
  { id: "invited", name: "Приглашён", color: "amber" },
  { id: "interview", name: "Собеседование", color: "violet" },
  { id: "processing", name: "Оформление", color: "teal" },
  { id: "confirmed", name: "Выход подтверждён", color: "green" },
  { id: "first_shift", name: "1-я смена", color: "green" },
  { id: "rejected", name: "Отказ", color: "red" },
  { id: "no_show", name: "Не вышел", color: "gray" },
];

export const STAGE_TIMELINE_ORDER = [
  "response",
  "invited",
  "interview",
  "processing",
  "confirmed",
  "first_shift",
] as const;

export function stageById(id: string): Stage {
  return STAGES.find((s) => s.id === id) ?? STAGES[0];
}

export function projectById(id: string): Project | undefined {
  return PROJECTS.find((p) => p.id === id);
}

export const CHANNELS: Channel[] = [
  { name: "HeadHunter", budget: 420000, responses: 612, invites: 298, processed: 171, shifts: 132 },
  { name: "Авито Работа", budget: 260000, responses: 498, invites: 231, processed: 126, shifts: 96 },
  { name: "Telegram Ads", budget: 150000, responses: 344, invites: 139, processed: 71, shifts: 52 },
  { name: "VK Реклама", budget: 120000, responses: 266, invites: 104, processed: 58, shifts: 41 },
  { name: "Яндекс Директ", budget: 190000, responses: 352, invites: 168, processed: 88, shifts: 63 },
  { name: "Реферальная программа", budget: 60000, responses: 158, invites: 97, processed: 71, shifts: 61 },
];

export interface NavItem {
  id: PortalPage;
  label: string;
  icon: IconName;
}

export const NAV_ITEMS: NavItem[] = [
  { id: "overview", label: "Обзор", icon: "home" },
  { id: "demand", label: "Потребность", icon: "grid" },
  { id: "candidates", label: "Кандидаты", icon: "users" },
  { id: "vacancies", label: "Описание вакансий", icon: "briefcase" },
  { id: "marketing", label: "Маркетинг", icon: "trend" },
  { id: "analytics", label: "Аналитика", icon: "bar" },
  { id: "notifications", label: "Уведомления", icon: "bell" },
  { id: "settings", label: "Настройки", icon: "gear" },
];

export const PAGE_TITLES: Record<PortalPage, string> = {
  overview: "Обзор",
  demand: "Потребность",
  candidates: "Кандидаты",
  vacancies: "Описание вакансий",
  marketing: "Маркетинг",
  analytics: "Аналитика",
  notifications: "Уведомления",
  settings: "Настройки",
};
