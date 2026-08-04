/**
 * Подключение к эфемерному локальному Supabase, поднятому `supabase start`
 * в CI (H-13). Намеренно **не** переиспользует `NEXT_PUBLIC_SUPABASE_*`/
 * `SUPABASE_JWT_PRIVATE_JWK` — те указывают на боевой проект, а RLS-тесты
 * не должны иметь возможность случайно подключиться к нему из-за
 * скопированного `.env.local`. Собственные имена переменных делают
 * невозможной путаницу между "тестовым" и "боевым" окружением.
 *
 * Значения задаёт CI-шаг после `supabase start` (см. `.github/workflows/ci.yml`,
 * job `rls-tests`) — локально их можно проставить вручную тем же способом
 * (`supabase status -o env`), если на машине есть Docker.
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} не задана. RLS-тесты требуют локальный Supabase, поднятый ` +
        `\`supabase start\`, и переменные окружения из \`supabase status\` — ` +
        `см. src/testing/rls/README.md.`,
    );
  }
  return value;
}

export const rlsTestEnv = {
  apiUrl: () => requireEnv("RLS_TEST_API_URL"),
  anonKey: () => requireEnv("RLS_TEST_ANON_KEY"),
  serviceRoleKey: () => requireEnv("RLS_TEST_SERVICE_ROLE_KEY"),
  jwtSecret: () => requireEnv("RLS_TEST_JWT_SECRET"),
};
