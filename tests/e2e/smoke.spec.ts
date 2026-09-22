import { expect, test } from "@playwright/test"

/**
 * فحص شامل لكل صفحة: تفتح، تعرض عنواناً، ولا تسجّل خطأ في الطرفية.
 * يمسك الانهيارات التي لا تلتقطها الاختبارات المتخصّصة.
 */

const PAGES = [
  // لوحة التحكم عنوانها تحية بالاسم لا اسم القسم
  ["dashboard", /الخير|مساء|صباح/],
  ["tasks", "المهام"],
  ["projects", "المشاريع"],
  ["notes", "الملاحظات"],
  ["university", "الجامعة"],
  ["goals", "الأهداف"],
  ["focus", "التركيز"],
  ["finance", "المالية"],
  ["calendar", "التقويم"],
  ["learning", "التعلّم"],
  ["bookmarks", "الروابط"],
  ["stats", "الإحصائيات"],
  ["settings", "الإعدادات"],
] as const satisfies ReadonlyArray<readonly [string, string | RegExp]>

for (const [path, heading] of PAGES) {
  test(`صفحة ${path} تفتح بلا أخطاء`, async ({ page }) => {
    const errors: string[] = []
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text())
    })
    page.on("pageerror", (error) => errors.push(error.message))

    const response = await page.goto(`/ar/${path}`)
    expect(response?.status()).toBe(200)

    await expect(
      page
        .getByRole("heading", {
          name: heading,
          exact: typeof heading === "string",
        })
        .first()
    ).toBeVisible()

    // نتجاهل أخطاء الشبكة العابرة لموارد التطوير
    const real = errors.filter(
      (text) => !/favicon|ERR_ABORTED|Download the React DevTools/i.test(text)
    )
    expect(real, `أخطاء في ${path}:\n${real.join("\n")}`).toHaveLength(0)
  })
}

test("الإنجليزية تعمل على كل الصفحات الرئيسية", async ({ page }) => {
  for (const path of ["dashboard", "tasks", "finance", "stats"]) {
    const response = await page.goto(`/en/${path}`)
    expect(response?.status()).toBe(200)
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr")
  }
})

test("جرس الإشعارات يعرض ما هو مستحق", async ({ page }) => {
  await page.goto("/ar/dashboard")

  const bell = page.getByRole("button", { name: /إشعار|الإشعارات/ }).first()
  await bell.click()

  // البيانات التجريبية فيها مهمة متأخرة وواجب اليوم
  const popover = page.getByText("الإشعارات", { exact: true })
  await expect(popover).toBeVisible()
})

test("الإعدادات تصدّر البيانات كملف", async ({ page }) => {
  await page.goto("/ar/settings")

  const downloadPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: "تنزيل" }).click()

  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^lifeos-\d{4}-\d{2}-\d{2}\.json$/)
})

test("بيان PWA صالح", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest")
  expect(response.status()).toBe(200)

  const manifest = await response.json()
  expect(manifest.short_name).toBe("LifeOS")
  expect(manifest.start_url).toBe("/ar/dashboard")
  expect(manifest.display).toBe("standalone")
  expect(manifest.icons.length).toBeGreaterThan(0)
})
