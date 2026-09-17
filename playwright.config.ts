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
/** Another dev server may already hold 3000; E2E_PORT moves the suite off it. */
const PORT = process.env.E2E_PORT ?? "3000";
const BASE_URL = `http://localhost:${PORT}`;

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
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    viewport: { width: 1440, height: 1000 },
  },
  webServer: {
    command: process.env.CI ? "npm run start" : "npm run dev",
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      ...process.env,
      PORT,
      // Phone login is flag-gated in production; the suite covers it, so the
      // server under test always has it on.
      OTP_LOGIN_ENABLED: "true",
      // A fixed Svix secret so the delivery-webhook spec can sign requests the
      // way Resend would. Base64 of "mezon-e2e-test-secret".
      RESEND_WEBHOOK_SECRET: "whsec_bWV6b24tZTJlLXRlc3Qtc2VjcmV0",
      // Fixed provider credentials so the payment spec can sign callbacks the
      // way Click and Payme do. Production has real ones; these are test-only.
      CLICK_SERVICE_ID: "12345",
      CLICK_MERCHANT_ID: "67890",
      CLICK_SECRET_KEY: "e2e-click-secret",
      PAYME_MERCHANT_ID: "e2e-payme-merchant",
      PAYME_KEY: "e2e-payme-key",
    } as Record<string, string>,
  },
});
