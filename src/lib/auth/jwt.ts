import { authEnv } from "./env";

/**
 * Выпуск JWT для доступа к данным.
 *
 * Портал сам проверяет логин и пароль (`portal_login`), но данные браузер
 * по-прежнему читает у PostgREST напрямую — значит, запросу нужен токен,
 * подпись которого Supabase признаёт. Портал подписывает его тем же
 * секретом проекта: RLS-политики продолжают работать для роли
 * `authenticated`, а `auth.uid()` (и, через него, авторство в
 * `staffing_demand_history`) отдаёт id пользователя портала.
 *
 * Токен короткоживущий и обновляется молча через `/api/auth/token`. Право
 * доступа он не несёт: роль и активность база читает из `portal_users` на
 * каждом запросе, поэтому смена роли и отключение учётки действуют сразу,
 * не дожидаясь истечения токена.
 *
 * Подпись — Web Crypto, а не node:crypto: тот же код работает и в Node, и в
 * Edge runtime.
 */

/** 15 минут: достаточно редко, чтобы не ходить за токеном на каждый запрос. */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

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

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function encodeSegment(value: object): string {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

/**
 * Подпись HS256 тем же секретом проекта. Вынесена из `signPortalJwt`, чтобы
 * сервисный токен ниже не дублировал криптографию; сам пользовательский
 * токен от этого не изменился — ни payload, ни результат.
 */
async function signHs256(signingInput: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(authEnv.jwtSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signingInput));
  return base64Url(new Uint8Array(signature));
}

export async function signPortalJwt({ userId, sessionId, role }: PortalJwtInput): Promise<PortalJwt> {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + ACCESS_TOKEN_TTL_SECONDS;

  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    // `sub` и `role` — то, на что смотрит PostgREST: под какой ролью
    // выполнять запрос и что вернёт auth.uid().
    sub: userId,
    role: "authenticated",
    aud: "authenticated",
    iat: issuedAt,
    exp: expiresAt,
    // Собственные claim'ы портала. `sid` нужен, чтобы при смене пароля не
    // обрывать сессию, из которой её меняют; `portal_role` — только для
    // диагностики, права по нему база не выдаёт.
    sid: sessionId,
    portal_role: role,
  };

  const signingInput = `${encodeSegment(header)}.${encodeSegment(payload)}`;
  return { token: `${signingInput}.${await signHs256(signingInput)}`, expiresAt };
}

/**
 * Сервисный токен для доверенных серверных вызовов auth-RPC.
 *
 * Зачем он нужен
 * --------------
 * `portal_login`, `portal_session_context` и `portal_logout` выданы роли
 * `anon`, то есть вызываются напрямую из браузера с публикуемым ключом, минуя
 * портал. Пока это так, любое ограничение частоты внутри функции
 * недостоверно: атакующий обращается к PostgREST сам и передаёт какой угодно
 * `p_ip` — или не передаёт вовсе. Закрытие прямого доступа (фаза 3) и есть то,
 * что делает ограничение по источнику осмысленным.
 *
 * PostgREST переключается на роль из claim `role`; роль `portal_auth_caller`
 * создана миграцией `20260801100000_login_rate_limit.sql` и не имеет НИ ОДНОГО
 * гранта на таблицы — только execute на эти три функции. Это сознательная
 * альтернатива `service_role`, который ради права вызвать одну функцию открыл
 * бы всю схему в обход RLS.
 *
 * Почему отдельная функция, а не параметр к `signPortalJwt`
 * --------------------------------------------------------
 * Общая функция допускала бы вызов, выпускающий сервисный токен с `sub`
 * конкретного пользователя. Здесь `sub` и `sid` отсутствуют намеренно:
 * `auth.uid()` под этим токеном пуст, и ни одна политика не примет его за
 * пользователя.
 */
export const PORTAL_AUTH_CALLER_ROLE = "portal_auth_caller";

/** Короткий: токен выпускает сервер для себя же, обновление ничего не стоит. */
export const SERVICE_TOKEN_TTL_SECONDS = 5 * 60;

/** Обновляем заранее, чтобы запрос не ушёл с токеном, истекающим в полёте. */
const SERVICE_TOKEN_REFRESH_MARGIN_MS = 30_000;

/**
 * Кэш сервисного токена на уровне модуля.
 *
 * БЕЗОПАСНО ЗДЕСЬ И НЕБЕЗОПАСНО В ДРУГИХ МЕСТАХ — разница принципиальная.
 *
 * В Node-процессе (а `resolveSession` вызывается и из серверных компонентов)
 * переменная модуля общая для всех запросов и всех пользователей. Для
 * ПОЛЬЗОВАТЕЛЬСКОГО токена это означало бы выдачу чужого токена — ровно та
 * мина, которая описана как находка M-14 в `docs/AUDIT-2026-07-31.md`
 * применительно к `lib/supabase/accessToken.ts`.
 *
 * Сервисный токен персональных данных не содержит вовсе: ни `sub`, ни `sid`,
 * ни роли пользователя портала. Он одинаков для всех запросов процесса по
 * построению, поэтому «утечь между пользователями» здесь нечему.
 *
 * НЕ КОПИРОВАТЬ этот приём на токены, содержащие `sub`.
 *
 * Кэш нужен не ради экономии на подписи (HMAC дёшев), а потому что
 * `portal_session_context` вызывается на каждый запрос, включая RSC-навигации:
 * без кэша на каждый из них приходился бы `importKey` + `sign`.
 */
let cachedServiceToken: { token: string; expiresAtMs: number } | null = null;

export async function signPortalServiceJwt(): Promise<string> {
  if (cachedServiceToken && cachedServiceToken.expiresAtMs - SERVICE_TOKEN_REFRESH_MARGIN_MS > Date.now()) {
    return cachedServiceToken.token;
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + SERVICE_TOKEN_TTL_SECONDS;

  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    // Роль, под которой PostgREST выполнит запрос. `sub`/`sid` намеренно нет.
    role: PORTAL_AUTH_CALLER_ROLE,
    // `aud` повторяет пользовательский токен: если у проекта настроена
    // проверка audience, значение уже доказано рабочим. Оно не связано с
    // ролью — это разные claim'ы.
    aud: "authenticated",
    iat: issuedAt,
    exp: expiresAt,
  };

  const signingInput = `${encodeSegment(header)}.${encodeSegment(payload)}`;
  const token = `${signingInput}.${await signHs256(signingInput)}`;

  cachedServiceToken = { token, expiresAtMs: expiresAt * 1000 };
  return token;
}
