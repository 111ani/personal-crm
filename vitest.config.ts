import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

import { getTestDatabaseUrl } from "./test/database-url";

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      // Same as "paths" in tsconfig.json
      { find: /^@\//, replacement: fromRoot("./src/") },
      // The real package throws outside Next.js
      { find: /^server-only$/, replacement: fromRoot("./test/empty.ts") },
    ],
  },
  test: {
    include: ["src/**/*.test.ts", "test/**/*.test.ts", "scripts/**/*.test.ts"],
    env: { DATABASE_URL: getTestDatabaseUrl() },
    globalSetup: ["./test/global-setup.ts"],
    setupFiles: ["./test/setup.ts"],
    // All test files share one database, so they run one at a time
    fileParallelism: false,
  },
});
