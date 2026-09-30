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

/** Пауза перед второй попыткой получить токен после сбоя сети. */
const RETRY_DELAY_MS = 500;

let cached: { token: string; expiresAtMs: number } | null = null;
let pending: Promise<string | null> | null = null;

/**
 * Срок жизни токена в миллисекундах — из его собственных `iat`/`exp`.
 *
 * Срок отсчитывается от часов браузера, а не берётся абсолютным `exp`
 * сервера. Иначе у пользователя, чьи часы отстают, токен считался живым
 * дольше, чем на самом деле: запросы уходили с уже истёкшим токеном,
 * PostgREST отвечал «JWT expired», и сохранение то проходило, то нет —
 * в зависимости от того, в какую минуту 15-минутного цикла нажали кнопку.
 */
export function tokenLifetimeMs(token: string): number | null {
  try {
    const segment = token.split(".")[1];
    if (!segment) return null;
    const json = atob(segment.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json) as { iat?: unknown; exp?: unknown };
    if (typeof payload.iat !== "number" || typeof payload.exp !== "number") return null;
    const lifetime = (payload.exp - payload.iat) * 1000;
    return lifetime > 0 ? lifetime : null;
  } catch {
    return null;
  }
}

async function requestAccessToken(): Promise<string | null> {
  const response = await fetch("/api/auth/token", { cache: "no-store" });
  if (!response.ok) return null;
  const data = (await response.json()) as { token: string; expires_at: number };
  const lifetime = tokenLifetimeMs(data.token);
  cached = {
    token: data.token,
    expiresAtMs: lifetime === null ? data.expires_at * 1000 : Date.now() + lifetime,
  };
  return data.token;
}

async function fetchAccessToken(): Promise<string | null> {
  try {
    return await requestAccessToken();
  } catch {
    // Сбой сети. Без токена запрос уйдёт анонимным и база ответит
    // «Недостаточно прав» — поэтому одна повторная попытка.
    cached = null;
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    try {
      return await requestAccessToken();
    } catch {
      cached = null;
      return null;
    }
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

/**
 * `fetch` для клиентов Supabase: если PostgREST отверг токен (401 — истёк
 * или не прошёл проверку), берём свежий и повторяем запрос один раз.
 * Страховка на случай, когда токен истёк раньше, чем думала вкладка
 * (сон ноутбука, перевод часов): без неё пользователь видел ошибку и
 * должен был нажимать «Сохранить» ещё раз.
 */
export async function fetchWithTokenRetry(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);
  if (response.status !== 401) return response;

  clearPortalAccessToken();
  const token = await getPortalAccessToken();
  if (!token) return response;

  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
