import { expect, test } from "@playwright/test"

test.describe("المصادقة وحماية المسارات", () => {
  test("زائر بلا جلسة يُعاد توجيهه لصفحة الدخول", async ({ browser }) => {
    // سياق نظيف بلا كوكيز
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const page = await context.newPage()

    await page.goto("/ar/tasks")
    await expect(page).toHaveURL(/\/ar\/login/)
    await expect(page.getByRole("button", { name: "تسجيل الدخول" })).toBeVisible()

    await context.close()
  })

  test("كلمة مرور خاطئة تعرض رسالة خطأ ولا تنشئ جلسة", async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const page = await context.newPage()

    await page.goto("/ar/login")
    await page.getByLabel("البريد الإلكتروني").fill("wrong@example.com")
    await page.getByLabel("كلمة المرور").fill("definitely-not-the-password")
    await page.getByRole("button", { name: "تسجيل الدخول" }).click()

    await expect(
      page.getByText("البريد الإلكتروني أو كلمة المرور غير صحيحة")
    ).toBeVisible()
    await expect(page).toHaveURL(/\/ar\/login/)

    await context.close()
  })

  test("مستخدم مسجّل يصل للوحة التحكم", async ({ page }) => {
    await page.goto("/ar/dashboard")
    await expect(page).toHaveURL(/\/ar\/dashboard/)
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  })

  test("صفحة الدخول تعيد المسجّل للوحة التحكم", async ({ page }) => {
    await page.goto("/ar/login")
    await expect(page).toHaveURL(/\/ar\/dashboard/)
  })
})
