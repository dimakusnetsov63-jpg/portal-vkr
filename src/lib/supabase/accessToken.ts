/**
 * Токен доступа к данным на стороне браузера.
 *
 * Сам токен сессии лежит в httpOnly-cookie и коду здесь недоступен — за
 * коротким токеном для PostgREST ходим на `/api/auth/token`. Он кэшируется
 * в памяти вкладки до истечения, поэтому на каждый запрос к Supabase
 * дополнительного обращения к серверу не возникает.
 */

/** Обновляем чуть раньше срока: запрос не должен уйти с токеном, истекающим в полёте. */
const REFRESH_MARGIN_MS = 60_000;

let cached: { token: string; expiresAtMs: number } | null = null;
let pending: Promise<string | null> | null = null;

async function fetchAccessToken(): Promise<string | null> {
  try {
    const response = await fetch("/api/auth/token", { cache: "no-store" });
    if (!response.ok) {
      cached = null;
      return null;
    }
    const data = (await response.json()) as { token: string; expires_at: number };
    cached = { token: data.token, expiresAtMs: data.expires_at * 1000 };
    return data.token;
  } catch {
    cached = null;
    return null;
  }
}

export async function getPortalAccessToken(): Promise<string | null> {
  if (cached && cached.expiresAtMs - REFRESH_MARGIN_MS > Date.now()) {
    return cached.token;
  }
  // Параллельные запросы к данным на старте раздела не должны выпускать
  // по токену каждый — они ждут один и тот же запрос.
  if (!pending) {
    const request = fetchAccessToken().finally(() => {
      pending = null;
    });
    pending = request;
    return request;
  }
  return pending;
}

/** Сбросить кэш — после выхода, чтобы токен не пережил сессию в этой вкладке. */
export function clearPortalAccessToken(): void {
  cached = null;
}
