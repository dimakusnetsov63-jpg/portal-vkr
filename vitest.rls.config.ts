import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// H-13: отдельный конфиг для RLS-тестов против эфемерного локального
// Supabase (`supabase start` в CI, job `rls-tests`). Сознательно отдельно
// от vitest.config.ts (include: "*.test.ts") — эти тесты требуют сеть и
// поднятую базу, обычные чистые unit-тесты не должны от них зависеть или
// ждать Docker. Файлы называются `*.rls-test.ts`, не `*.test.ts`, поэтому
// исходный конфиг их не подхватывает даже случайно.
export default defineConfig({
  test: {
    include: ["src/**/*.rls-test.ts"],
    // Поднятие контейнеров и сетевые запросы медленнее чистых unit-тестов —
    // дефолтный таймаут vitest (5с) слишком короткий для этого класса тестов.
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
