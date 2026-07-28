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
   * Секрет, которым Supabase (PostgREST) проверяет подпись JWT:
   * Dashboard → Project Settings → API → JWT Settings → JWT Secret.
   *
   * Портал подписывает им собственные короткоживущие токены доступа к данным
   * — см. `jwt.ts` и ADR-004. Если секрет неверный, вход пройдёт, но любой
   * запрос к данным вернёт 401.
   */
  jwtSecret: () => requireEnv("SUPABASE_JWT_SECRET", process.env.SUPABASE_JWT_SECRET),
};
