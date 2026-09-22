import "dotenv/config"

import { defineConfig, devices } from "@playwright/test"

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000"

/**
 * نستخدم متصفح النظام المثبّت (Chrome/Edge) بدل تنزيل نسخة Playwright.
 * اضبط PLAYWRIGHT_CHANNEL=chromium لاستخدام النسخة المنزّلة إن توفّرت.
 */
const BROWSER_CHANNEL = (process.env.PLAYWRIGHT_CHANNEL ?? "chrome") as
  | "chrome"
  | "msedge"
  | undefined

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : [["list"]],

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    locale: "ar",
    timezoneId: "Asia/Riyadh",
  },

  projects: [
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
      use: { ...devices["Desktop Chrome"], channel: BROWSER_CHANNEL },
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel: BROWSER_CHANNEL,
        storageState: "tests/.auth/user.json",
      },
      dependencies: ["setup"],
    },
    {
      name: "mobile",
      use: {
        ...devices["Pixel 7"],
        channel: BROWSER_CHANNEL,
        storageState: "tests/.auth/user.json",
      },
      dependencies: ["setup"],
      testMatch: /mobile\.spec\.ts/,
    },
  ],

  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
