import { defineConfig } from "@playwright/test";

/**
 * E2E suite (tests/e2e). Runs ONLY against a disposable localhost Postgres —
 * global-setup refuses anything else, so it can never touch real data.
 *
 * Local run:
 *   1. docker run -d -p 5433:5432 -e POSTGRES_USER=mezon -e POSTGRES_PASSWORD=mezon \
 *        -e POSTGRES_DB=mezon_test postgres:16
 *   2. E2E_TEST=1 DATABASE_URL=postgresql://mezon:mezon@localhost:5433/mezon_test \
 *        npm run db:migrate && E2E_TEST=1 DATABASE_URL=... npm run test:e2e
 *
 * CI (.github/workflows/e2e.yml) does exactly this with a service container.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup",
  // Specs share one seeded DB; serial keeps counts/badges deterministic.
  workers: 1,
  fullyParallel: false,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    viewport: { width: 1440, height: 1000 },
  },
  webServer: {
    command: process.env.CI ? "npm run start" : "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: false,
    timeout: 180_000,
    env: { ...process.env } as Record<string, string>,
  },
});
