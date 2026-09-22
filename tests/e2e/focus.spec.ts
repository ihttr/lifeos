import { expect, test } from "@playwright/test"

test.describe("التركيز", () => {
  test.beforeEach(async ({ page }) => {
    // نبدأ من حالة نظيفة: المؤقت يحفظ تقدمه في localStorage
    await page.goto("/ar/focus")
    await page.evaluate(() => localStorage.removeItem("lifeos:pomodoro"))
    await page.reload()
    await expect(
      page.getByRole("heading", { name: "التركيز", exact: true })
    ).toBeVisible()
  })

  test("المؤقت يبدأ ويتوقف ويظهر العدّ التنازلي", async ({ page }) => {
    await expect(page.getByText("25:00")).toBeVisible()
    await expect(page.getByText("وقت عمل")).toBeVisible()

    await page.getByRole("button", { name: "ابدأ" }).click()
    await expect(page.getByRole("button", { name: "إيقاف مؤقت" })).toBeVisible()

    // العدّاد ينزل فعلياً
    await expect(page.getByText("25:00")).toHaveCount(0, { timeout: 4000 })

    await page.getByRole("button", { name: "إيقاف مؤقت" }).click()
    await expect(page.getByRole("button", { name: "ابدأ" })).toBeVisible()
  })

  test("التقدم ينجو من إعادة تحميل الصفحة", async ({ page }) => {
    await page.getByRole("button", { name: "ابدأ" }).click()
    await page.waitForTimeout(2500)

    const before = await page.locator("span[dir='ltr']").first().textContent()
    await page.reload()

    // ما زال يعمل، والوقت تقدّم لا رجع لـ 25:00
    await expect(page.getByRole("button", { name: "إيقاف مؤقت" })).toBeVisible()
    await expect(page.getByText("25:00")).toHaveCount(0)

    const after = await page.locator("span[dir='ltr']").first().textContent()
    expect(after).not.toBe("25:00")
    expect(before).not.toBe(after) // استمر العدّ أثناء إعادة التحميل
  })

  test("تخطّي الطور ينقل للاستراحة", async ({ page }) => {
    await expect(page.getByText("وقت عمل")).toBeVisible()

    await page.getByRole("button", { name: "تخطّي الطور" }).click()

    await expect(page.getByText("استراحة قصيرة")).toBeVisible()
    // نقرأ من شاشة المؤقت تحديداً — "05:00" قد يظهر في قوائم أخرى
    await expect(page.locator("span[dir='ltr']").first()).toHaveText("05:00")
  })

  test("تغيير الإعدادات ينعكس على المؤقت", async ({ page }) => {
    await page.getByRole("button", { name: "الإعدادات" }).click()
    await page.getByLabel("مدة العمل").fill("30")
    await page.getByLabel("الاستراحة القصيرة").fill("7")
    await page.getByRole("button", { name: "حفظ" }).click()

    await expect(page.locator("span[dir='ltr']").first()).toHaveText("30:00")

    // نعيدها لقيمها الأصلية
    await page.getByRole("button", { name: "الإعدادات" }).click()
    await page.getByLabel("مدة العمل").fill("25")
    await page.getByLabel("الاستراحة القصيرة").fill("5")
    await page.getByRole("button", { name: "حفظ" }).click()
    await expect(page.locator("span[dir='ltr']").first()).toHaveText("25:00")
  })

  test("المخطط يعرض جدولاً مكافئاً لقارئ الشاشة", async ({ page }) => {
    const table = page.getByRole("table", { name: /التركيز اليومي/ })
    await expect(table).toBeAttached()

    // ٢٨ يوماً + صف الترويسة
    await expect(table.getByRole("row")).toHaveCount(29)
  })
})
