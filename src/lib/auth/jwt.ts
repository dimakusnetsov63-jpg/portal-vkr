import { authEnv } from "./env";

/**
 * Выпуск JWT для доступа к данным — ES256 (ECDSA P-256), C-5.
 *
 * Портал сам проверяет логин и пароль (`portal_login`), но данные браузер
 * по-прежнему читает у PostgREST напрямую — значит, запросу нужен токен,
 * подпись которого Supabase признаёт. До C-5 портал подписывал его тем же
 * симметричным секретом проекта (HS256), что и PostgREST использовал для
 * проверки — общий секрет без встроенной ротации. Теперь — собственная пара
 * ключей ES256, зарегистрированная в Supabase через JWT Signing Keys
 * (см. `docs/ROLLOUT-jwt-signing-keys.md`): приватная половина не покидает
 * это приложение, публичная известна Supabase из Dashboard.
 *
 * Подпись реализована вручную через Web Crypto, а не библиотекой (`jose` и
 * т.п.): весь модуль — меньше двухсот строк, а лишняя зависимость в
 * security-critical коде — это код, который тоже нужно аудировать. Та же
 * причина, по которой это уже было решено для HS256-версии этого файла.
 *
 * Построение токена разложено на чистые функции (`buildJwtHeader`,
 * `buildPortalPayload`, `buildPortalServicePayload`, `encodeJwt`) отдельно от
 * единственной не-чистой части (`signJwt`, реальный вызов Web Crypto) —
 * это и есть тестируемая поверхность модуля, см. `jwt.test.ts`. Что именно
 * тестируется, а что нет: код продолжает подписывать корректно оформленный
 * токен ES256 — это тестируется. Примет ли этот токен именно PostgREST (тот
 * ли `kid`, действительно ли ключ импортирован в Dashboard) — это ответственность
 * Supabase, и она проверяется один раз вручную по чек-листу ретенции,
 * а не сетевым запросом на каждом холодном старте.
 */

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const SERVICE_TOKEN_TTL_SECONDS = 5 * 60;

/** Роль, под которой PostgREST выполняет доверенные серверные вызовы auth-RPC. Создана миграцией `20260801100000_login_rate_limit.sql`, без единого гранта на таблицы. */
export const PORTAL_AUTH_CALLER_ROLE = "portal_auth_caller";

const JWT_ALG = "ES256";

export interface PortalJwtInput {
  userId: string;
  sessionId: string;
  role: string;
}

export interface PortalJwt {
  token: string;
  /** Unix-время истечения, секунды. */
  expiresAt: number;
}

interface JwtHeader {
  alg: typeof JWT_ALG;
  /** Идентификатор ключа в Supabase JWT Signing Keys. Берётся из самого приватного ключа (см. `importPortalSigningKey`) — отдельного поля для его настройки нет, рассинхронизировать нечего. */
  kid: string;
  typ: "JWT";
}

interface PortalUserJwtPayload {
  sub: string;
  role: "authenticated";
  aud: "authenticated";
  iat: number;
  exp: number;
  sid: string;
  portal_role: string;
}

interface PortalServiceJwtPayload {
  role: typeof PORTAL_AUTH_CALLER_ROLE;
  aud: "authenticated";
  iat: number;
  exp: number;
}

// ---- Base64URL и сборка частей токена — чистые функции, без крипто -----

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function encodeSegment(value: object): string {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

export function buildJwtHeader(kid: string): JwtHeader {
  return { alg: JWT_ALG, kid, typ: "JWT" };
}

/**
 * Payload пользовательского токена. `nowSeconds` — параметр, а не
 * `Date.now()` внутри функции: делает её чистой и тестируемой без подмены
 * системного времени.
 */
export function buildPortalPayload(input: PortalJwtInput, nowSeconds: number): PortalUserJwtPayload {
  return {
    // `sub` и `role` — то, на что смотрит PostgREST: под какой ролью
    // выполнять запрос и что вернёт auth.uid().
    sub: input.userId,
    role: "authenticated",
    aud: "authenticated",
    iat: nowSeconds,
    exp: nowSeconds + ACCESS_TOKEN_TTL_SECONDS,
    // Собственные claim'ы портала. `sid` нужен, чтобы при смене пароля не
    // обрывать сессию, из которой её меняют; `portal_role` — только для
    // диагностики, права по нему база не выдаёт.
    sid: input.sessionId,
    portal_role: input.role,
  };
}

export function buildPortalServicePayload(nowSeconds: number): PortalServiceJwtPayload {
  return {
    role: PORTAL_AUTH_CALLER_ROLE,
    aud: "authenticated",
    iat: nowSeconds,
    exp: nowSeconds + SERVICE_TOKEN_TTL_SECONDS,
  };
}

/**
 * Base64URL-сериализация `header.payload` — часть токена, которую подписывает
 * `signJwt`. Отдельно от подписи, чтобы тестировать сборку без реального
 * ключа: у любого валидного JWT эта часть проверяется декодированием, а не
 * доверием к тому, что подпись где-то дальше сойдётся.
 */
export function encodeJwt(header: object, payload: object): string {
  return `${encodeSegment(header)}.${encodeSegment(payload)}`;
}

// ---- Подпись — единственная не-чистая часть модуля ---------------------

/**
 * Подписывает готовую строку `header.payload` алгоритмом ES256. Возвращает
 * только base64url-подпись, не итоговый токен — сборка `signingInput +
 * "." + подпись` остаётся на вызывающей стороне, симметрично тому, что
 * `encodeJwt` не подписывает то, что собрала.
 */
export async function signJwt(signingInput: string, privateKey: CryptoKey): Promise<string> {
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    new TextEncoder().encode(signingInput),
  );
  return base64Url(new Uint8Array(signature));
}

// ---- Ключ: парсинг env, импорт, кэш на процесс --------------------------

interface PortalSigningKey {
  kid: string;
  cryptoKey: CryptoKey;
}

let cachedSigningKey: Promise<PortalSigningKey> | null = null;

/**
 * Импортирует приватный ключ из `SUPABASE_JWT_PRIVATE_JWK` один раз за
 * время жизни процесса и кэширует результат: `crypto.subtle.importKey` не
 * бесплатен, а ключ не меняется без деплоя.
 *
 * Намеренно НЕТ сетевой проверки, что этот `kid` действительно
 * зарегистрирован в Supabase (например, запросом к
 * `.well-known/jwks.json`). Если это не так, PostgREST отклонит подпись при
 * первом же запросе — дублирование этой проверки в приложении добавило бы
 * сетевую зависимость и кэш ради результата, который и так виден по первому
 * реальному отказу и не предотвращает его иначе, чем сам факт отказа.
 * Соответствие ключа Dashboard проверяется один раз вручную, по чек-листу
 * `docs/ROLLOUT-jwt-signing-keys.md`, а не на каждом холодном старте.
 */
function importPortalSigningKey(): Promise<PortalSigningKey> {
  if (!cachedSigningKey) {
    cachedSigningKey = (async () => {
      let jwk: JsonWebKey & { kid?: string };
      try {
        jwk = JSON.parse(authEnv.jwtPrivateJwk());
      } catch (cause) {
        throw new Error("SUPABASE_JWT_PRIVATE_JWK: значение не является корректным JSON", { cause });
      }
      if (!jwk.kid) {
        throw new Error("SUPABASE_JWT_PRIVATE_JWK: в ключе отсутствует поле kid");
      }
      let cryptoKey: CryptoKey;
      try {
        cryptoKey = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, [
          "sign",
        ]);
      } catch (cause) {
        throw new Error("SUPABASE_JWT_PRIVATE_JWK: не удалось импортировать ключ (ожидается EC, кривая P-256)", {
          cause,
        });
      }
      return { kid: jwk.kid, cryptoKey };
    })();
  }
  return cachedSigningKey;
}

// ---- Публичные функции выпуска токенов ----------------------------------

export async function signPortalJwt(input: PortalJwtInput): Promise<PortalJwt> {
  const { kid, cryptoKey } = await importPortalSigningKey();
  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = buildJwtHeader(kid);
  const payload = buildPortalPayload(input, nowSeconds);
  const signingInput = encodeJwt(header, payload);
  const signature = await signJwt(signingInput, cryptoKey);
  return { token: `${signingInput}.${signature}`, expiresAt: payload.exp };
}

/**
 * Сервисный токен для доверенных серверных вызовов auth-RPC (`portal_login`,
 * `portal_session_context`, `portal_logout`).
 *
 * Зачем он нужен и почему кэш на уровне модуля здесь безопасен, а для
 * пользовательского токена был бы утечкой между пользователями — см.
 * `docs/AUDIT-2026-07-31.md`, находка M-14, и комментарий на
 * `lib/supabase/accessToken.ts`. Коротко: в этом токене нет ни `sub`, ни
 * `sid` — он одинаков для всех запросов процесса по построению, поэтому
 * делить его между запросами нечем.
 */
const SERVICE_TOKEN_REFRESH_MARGIN_MS = 30_000;
let cachedServiceToken: { token: string; expiresAtMs: number } | null = null;

export async function signPortalServiceJwt(): Promise<string> {
  if (cachedServiceToken && cachedServiceToken.expiresAtMs - SERVICE_TOKEN_REFRESH_MARGIN_MS > Date.now()) {
    return cachedServiceToken.token;
  }

  const { kid, cryptoKey } = await importPortalSigningKey();
  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = buildJwtHeader(kid);
  const payload = buildPortalServicePayload(nowSeconds);
  const signingInput = encodeJwt(header, payload);
  const signature = await signJwt(signingInput, cryptoKey);
  const token = `${signingInput}.${signature}`;

  cachedServiceToken = { token, expiresAtMs: payload.exp * 1000 };
  return token;
}
