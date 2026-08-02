/**
 * Серверные переменные окружения авторизации. Без префикса NEXT_PUBLIC_ —
 * в клиентский бандл не попадают и попасть не должны.
 */

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing environment variable: ${name}. Check your .env.local file.`);
  }
  return value;
}

export const authEnv = {
  /**
   * Приватный ключ ES256 (JWK, включая `kid`), которым портал подписывает
   * собственные короткоживущие токены доступа к данным — см. `jwt.ts` и
   * ADR-004. Публичная половина зарегистрирована в Supabase: Dashboard →
   * Project Settings → API → JWT Signing Keys (C-5,
   * `docs/ROLLOUT-jwt-signing-keys.md`).
   *
   * До C-5 здесь был симметричный `SUPABASE_JWT_SECRET` (HS256) — общий
   * секрет без встроенной ротации, которым PostgREST одновременно и
   * подписывал бы, и проверял, будь он у него. Значение этой переменной
   * возвращается как есть (строка JSON) — парсинг и валидация формы ключа
   * происходят в `jwt.ts`, рядом с остальной криптографией.
   *
   * Если ключ неверный или не импортирован в Supabase под тем же `kid`,
   * вход пройдёт (портал сам проверяет пароль), но любой запрос к данным
   * вернёт 401 — тот же режим отказа, что был у HS256-версии.
   */
  jwtPrivateJwk: () => requireEnv("SUPABASE_JWT_PRIVATE_JWK", process.env.SUPABASE_JWT_PRIVATE_JWK),
};
