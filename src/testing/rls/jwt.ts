import { createHmac } from "node:crypto";
import { rlsTestEnv } from "./env";

/**
 * Подписывает тестовый JWT секретом **локального** эфемерного Supabase —
 * HS256, не ES256 из `src/lib/auth/jwt.ts`. Это осознанно: RLS-тесты
 * проверяют SQL-логику политик при заявленной личности (`sub`/`role`),
 * а не то, что приложение умеет правильно подписывать ES256 — это уже
 * покрыто `jwt.test.ts`. Смешивать два разных предмета проверки в одном
 * тесте значит усложнять диагностику, когда что-то упадёт.
 */

function base64Url(input: Buffer): string {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function encodeSegment(value: object): string {
  return base64Url(Buffer.from(JSON.stringify(value), "utf8"));
}

/** Токен под конкретного тестового пользователя портала — `sub` = id строки в `portal_users`. */
export function signTestUserJwt(userId: string): string {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: userId,
    role: "authenticated",
    aud: "authenticated",
    iat: now,
    exp: now + 5 * 60,
  };
  const signingInput = `${encodeSegment(header)}.${encodeSegment(payload)}`;
  const signature = base64Url(createHmac("sha256", rlsTestEnv.jwtSecret()).update(signingInput).digest());
  return `${signingInput}.${signature}`;
}
