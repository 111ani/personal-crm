import { defineConfig, devices } from "@playwright/test";

import { authEnvironment } from "./e2e/auth-environment";
import { getE2eDatabaseUrl } from "./test/database-url";

// Not 3000: an app started there by hand works with the main database
const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  // All tests share one database, so they run one at a time
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // The production build, rebuilt on every run: tests always check the
    // current code, the way users get it
    command: `pnpm build && pnpm start --port ${PORT}`,
    // Ready check that needs no database: Playwright starts the server
    // before globalSetup, which creates and migrates the e2e database
    url: `${baseURL}/favicon.ico`,
    // A server already running there may be connected to the main database
    reuseExistingServer: false,
    timeout: 5 * 60_000,
    env: authEnvironment(baseURL, getE2eDatabaseUrl()),
  },
});
