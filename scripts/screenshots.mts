/**
 * يلتقط لقطات للصفحات الرئيسية للمراجعة البصرية.
 *   node --import tsx scripts/screenshots.mts
 *
 * يتطلب: خادم التطوير يعمل، و tests/.auth/user.json موجود
 * (يُنشأ بـ npx playwright test --project=setup).
 */

import { mkdir, rm } from "node:fs/promises"

import { chromium } from "@playwright/test"

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000"
const OUT = "screenshots"

const PAGES = [
  ["dashboard", "/ar/dashboard"],
  ["tasks-list", "/ar/tasks"],
  ["tasks-board", "/ar/tasks?view=board"],
  ["tasks-calendar", "/ar/tasks?view=calendar"],
  ["projects", "/ar/projects"],
  ["notes", "/ar/notes"],
  ["university", "/ar/university"],
  ["university-assignments", "/ar/university?tab=assignments"],
  ["university-exams", "/ar/university?tab=exams"],
  ["dashboard-en", "/en/dashboard"],
] as const

async function main() {
  await rm(OUT, { recursive: true, force: true })
  await mkdir(OUT, { recursive: true })

  const browser = await chromium.launch({ channel: "chrome" })

  for (const theme of ["dark", "light"] as const) {
    for (const [device, viewport] of [
      ["desktop", { width: 1440, height: 900 }],
      ["mobile", { width: 390, height: 844 }],
    ] as const) {
      const context = await browser.newContext({
        storageState: "tests/.auth/user.json",
        viewport,
        colorScheme: theme,
        locale: "ar",
        timezoneId: "Asia/Riyadh",
        deviceScaleFactor: 2,
      })

      const page = await context.newPage()

      for (const [name, path] of PAGES) {
        // تخطّي التكرار: نلتقط الإنجليزية على سطح المكتب الداكن فقط
        if (name.endsWith("-en") && !(theme === "dark" && device === "desktop"))
          continue

        await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" })
        await page.waitForTimeout(400)
        await page.screenshot({
          path: `${OUT}/${device}-${theme}-${name}.png`,
          fullPage: device === "mobile",
        })
      }

      await context.close()
    }
  }

  await browser.close()
  console.log(`✓ اللقطات في ${OUT}/`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
