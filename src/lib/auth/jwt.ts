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
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(authEnv.jwtSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signingInput));

  return { token: `${signingInput}.${base64Url(new Uint8Array(signature))}`, expiresAt };
}
