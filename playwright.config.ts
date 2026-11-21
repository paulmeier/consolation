import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests drive Consolation against a running AWS Emulator.
 *
 * - Locally with a dev server already running: E2E_BASE_URL=http://127.0.0.1:3210 npm run test:e2e
 * - Otherwise Playwright builds and starts the app on 127.0.0.1:3100.
 * The emulator must be running and its run files must be in ~/.aws/emulator/<port>/.
 */
const external = process.env.E2E_BASE_URL;
const baseURL = external ?? "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: external
    ? undefined
    : {
        command: "npm run build && npx next start -H 127.0.0.1 -p 3100",
        url: `${baseURL}/settings`,
        timeout: 300_000,
        reuseExistingServer: !process.env.CI,
      },
});
