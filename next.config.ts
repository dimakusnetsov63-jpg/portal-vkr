import type { NextConfig } from "next";

/**
 * Заголовки безопасности (C-2.1 из docs/AUDIT-2026-07-31.md).
 *
 * Живут здесь, а не в `src/proxy.ts`, по двум причинам. Первая —
 * покрытие: matcher middleware намеренно исключает `_next/static`,
 * `_next/image` и картинки, то есть часть ответов осталась бы без
 * заголовков, а `headers()` применяется ко всем маршрутам. Вторая —
 * разделение ответственности: `proxy.ts` отвечает за доступ (сессия,
 * активность, права на раздел) и имеет семь точек возврата; добавление
 * туда HTTP-политики смешало бы две разные задачи в файле, ошибка в
 * котором означает падение авторизации.
 *
 * CSP здесь пока НЕТ — она вводится отдельно и поэтапно (C-2.2
 * Report-Only, затем C-2.3 enforcement с nonce). Причина: в портале
 * 50 инлайновых `style={{}}`, из-за которых `style-src` в любом случае
 * потребует `'unsafe-inline'`, пока не закрыта находка M-27. Включать
 * жёсткую политику до этого — значит зафиксировать заведомо слабую
 * директиву и потом переделывать.
 */
const securityHeaders = [
  // Запрещает браузеру угадывать тип содержимого вопреки Content-Type.
  { key: "X-Content-Type-Options", value: "nosniff" },

  // Портал никуда не встраивается: iframe с ним — это clickjacking на
  // административные действия («Отключить доступ», «Удалить блок условий»).
  // Продублируется директивой frame-ancestors, когда появится CSP.
  { key: "X-Frame-Options", value: "DENY" },

  // Полный URL уходит только на свой origin. Иначе строка поиска раздела
  // «Потребность» (`?q=<фамилия>`) утекала бы в Referer при переходе по
  // внешней ссылке из карточки документа в «Адресах».
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },

  // Ни один из этих API порталу не нужен — отключаем, чтобы внедрённый
  // скрипт не мог к ним обратиться.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },

  // Два года; поддомены включены сознательно — все домены проекта
  // обслуживает Vercel, который принуждает HTTPS, а будущие `api.*`/`admin.*`
  // не должны случайно оказаться доступны по HTTP.
  //
  // `preload` намеренно НЕ добавлен: это отдельное обязательство перед
  // hstspreload.org, которое трудно отозвать, и брать его стоит только
  // убедившись, что вся DNS-зона под контролем.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

/**
 * Origin Supabase для `connect-src`.
 *
 * Точный хост, а не `https://*.supabase.co`: wildcard разрешил бы соединение
 * с любым чужим проектом Supabase, то есть при наличии XSS дал бы готовый
 * канал эксфильтрации. Значение и так публично — оно приходит из
 * `NEXT_PUBLIC_*` и лежит в клиентском бандле.
 *
 * Fallback на wildcard нужен, чтобы сборка не падала там, где переменная не
 * задана (например, при анализе бандла в чистом окружении): CSP тогда просто
 * менее строгая, а не сломанная.
 */
const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
  : "https://*.supabase.co";

/**
 * CSP в режиме наблюдения (C-2.2a). Ничего не блокирует — только сообщает о
 * нарушениях в консоль браузера. Приёмник отчётов (`report-uri`/`report-to`)
 * намеренно не задан: это была бы новая неаутентифицированная точка входа
 * без ограничения частоты и без логирования, то есть ровно та поверхность,
 * которую закрывает C-3.
 *
 * Известно заранее, что сработает `script-src`: Next.js отдаёт шесть
 * инлайновых <script> с RSC-payload на страницу, и без nonce они политике не
 * соответствуют. Это ожидаемо и является измерением для C-2.3, а не
 * дефектом.
 *
 * `'unsafe-inline'` в `style-src` — сознательная уступка: в портале 50
 * инлайновых `style={{}}` (находка M-27). Инлайновых <style>-блоков при этом
 * ноль, поэтому после закрытия M-27 директиву можно будет ужесточить до
 * `style-src 'self'; style-src-attr 'unsafe-inline'`.
 *
 * `wss:` не добавлен намеренно — Supabase Realtime в портале не используется.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  // `data:` обязателен: стрелка селекта в primitives.module.css — inline SVG.
  "img-src 'self' data: https:",
  // Шрифты самохостятся next/font, внешний домен не нужен.
  "font-src 'self'",
  `connect-src 'self' ${supabaseOrigin}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          ...securityHeaders,
          { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicy },
        ],
      },
    ];
  },
};

export default nextConfig;
