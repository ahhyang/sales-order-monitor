import { defineConfig, devices } from "@playwright/test";

// End-to-end tests run against a production build (`npm run build` first) talking to the real mock API.
const PORT = 3100;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    // All test traffic comes from one IP, so lift the per-IP limit for the run.
    env: { RATE_LIMIT_PER_MIN: "10000", EXPORT_LIMIT_PER_MIN: "1000" },
  },
});
