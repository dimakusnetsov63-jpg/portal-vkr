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
    // Файлы выполняются по очереди, а не параллельно. Все они работают с
    // одной базой, а `permissionAdmin.rls-test.ts` (фаза D) меняет
    // **глобальную** матрицу `portal_section_permissions` — при
    // параллельном прогоне соседний файл увидел бы её в изменённом виде и
    // упал бы на сверке baseline. Изоляции по маркеру, которой хватает
    // фикстурам в таблицах данных, здесь недостаточно: у матрицы прав нет
    // «своей строки на тест», она одна на всю базу.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
