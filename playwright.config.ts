import { defineConfig, devices } from "@playwright/test";

/**
 * E2E happy-path suite (Phase 15). Requires both apps running against a
 * real Supabase project — see e2e/README.md for setup and env vars. Not
 * run in this repo's CI by default (needs live Claude/Supabase creds);
 * intended for local/staging verification before a release.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: process.env.E2E_ADMIN_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
