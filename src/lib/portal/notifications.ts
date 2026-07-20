import type { NotificationType, PortalNotification } from "./types";

export const NOTIF_TYPE_LABELS: Record<NotificationType, { label: string; icon: string }> = {
  critical: { label: "Критично", icon: "alert" },
  important: { label: "Важно", icon: "bell" },
  info: { label: "Инфо", icon: "info" },
};

export const INITIAL_NOTIFICATIONS: PortalNotification[] = [
  { id: 1, type: "critical", title: "Критический дефицит: X5, Уфа", text: "Не закрыто 9 из 12 позиций на ближайшие 3 дня.", project: "X5 Group", minsAgo: 35, read: false },
  { id: 2, type: "critical", title: "Провал плана выходов: Купер, Новосибирск", text: "Факт выходов ниже плана на 41% третий день подряд.", project: "Купер", minsAgo: 80, read: false },
  { id: 3, type: "important", title: "Рост стоимости привлечения", text: "CPA по каналу Telegram Ads вырос на 18% за неделю.", project: "Маркетинг", minsAgo: 130, read: false },
  { id: 4, type: "important", title: "Истекает срок оформления", text: "6 кандидатов ожидают оформления более 48 часов.", project: "Самокат", minsAgo: 210, read: false },
  { id: 5, type: "info", title: "Новый проект добавлен в систему", text: "Ozon Fresh подключён к порталу, добавлены 3 города.", project: "Ozon Fresh", minsAgo: 340, read: true },
  { id: 6, type: "important", title: "Отклонение от плана по Казани", text: "X5 в Казани отстаёт от плана на 14%.", project: "X5 Group", minsAgo: 420, read: true },
  { id: 7, type: "info", title: "Обновлена матрица потребности", text: "Координатор добавил потребность на август для 4 проектов.", project: "Потребность", minsAgo: 610, read: true },
  { id: 8, type: "critical", title: "Массовый отказ кандидатов", text: "11 кандидатов отменили выход на смену в Санкт-Петербурге.", project: "Купер", minsAgo: 900, read: true },
  { id: 9, type: "info", title: "Еженедельный отчёт готов", text: "Сводка по конверсии воронки за неделю доступна в Аналитике.", project: "Аналитика", minsAgo: 1200, read: true },
  { id: 10, type: "important", title: "Новый рекрутер добавлен в команду", text: "Павел Григорьев получил доступ к проектам X5 и Самокат.", project: "Команда", minsAgo: 1500, read: true },
  { id: 11, type: "info", title: "Плановое обслуживание портала", text: "Технические работы запланированы на выходные, 25 июля.", project: "Система", minsAgo: 2200, read: true },
  { id: 12, type: "important", title: "Высокая конверсия канала", text: "Реферальная программа показывает конверсию выше среднего на 22%.", project: "Маркетинг", minsAgo: 2600, read: true },
];
