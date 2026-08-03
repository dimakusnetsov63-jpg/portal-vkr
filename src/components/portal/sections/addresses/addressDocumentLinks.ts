/**
 * Проверка ссылки на документ (находка H-3).
 *
 * Белый список схем, а не чёрный: разрешены только `http:`/`https:`. React
 * не санитизирует `href`, поэтому `javascript:...` без этой проверки
 * становится хранимой XSS — «Адреса» доступны всем ролям, включая
 * рекрутёра, наименее доверенную из них.
 *
 * `new URL(...)` вместо проверки префикса строки: так отсекаются и менее
 * очевидные обходы (`  javascript:...` с пробелом, `JAVASCRIPT:` в другом
 * регистре, `\tjavascript:...`) — браузер и `URL` парсер нормализуют схему
 * одинаково, ручной regex пришлось бы держать в синхроне с этим поведением.
 */
export function isSafeDocumentUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
