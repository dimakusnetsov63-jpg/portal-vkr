"use client";

import { Component, type ReactNode } from "react";
import { CrashState } from "./StateViews";

/**
 * Граница ошибок вокруг активного раздела.
 *
 * Заведена по факту: в журнале действий одна запись неожиданной формы
 * бросала TypeError при рендере, и вместе с панелью с экрана уходил **весь
 * портал** — пустая страница вместо меню, шапки и возможности уйти в другой
 * раздел. Ошибка была на одну строку, последствие — на всё приложение.
 *
 * Граница стоит вокруг раздела, а не вокруг всего портала: оболочка
 * (меню, шапка, поиск) должна пережить падение раздела — иначе уйти из
 * сломанного места можно только перезагрузкой. И не вокруг каждой панели:
 * рассыпать по интерфейсу десяток одинаковых обёрток значит спрятать
 * поломку, а не показать её.
 *
 * Границы — единственный способ поймать ошибку рендера в React, и они
 * бывают только классовыми компонентами: хука с такой семантикой нет.
 */
export class SectionErrorBoundary extends Component<
  { children: ReactNode; onReset?: () => void },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Не тост и не молчание: тост исчезнет, а молчание оставит поломку
    // незамеченной до следующей жалобы.
    console.error("Раздел портала упал при отрисовке:", error);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <CrashState
        onRetry={() => {
          this.setState({ error: null });
          this.props.onReset?.();
        }}
      />
    );
  }
}
