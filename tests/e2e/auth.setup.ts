import { expect, test as setup } from "@playwright/test"

const STORAGE = "tests/.auth/user.json"

/**
 * يسجّل الدخول مرة واحدة ويحفظ الجلسة لبقية الاختبارات.
 * بيانات الدخول من البيئة فقط — لا تُكتب في الكود أبداً.
 */
setup("authenticate", async ({ page }) => {
  const email = process.env.SEED_USER_EMAIL
  const password = process.env.SEED_USER_PASSWORD

  if (!email || !password) {
    throw new Error("املأ SEED_USER_EMAIL و SEED_USER_PASSWORD في .env")
  }

  await page.goto("/ar/login")

  await page.getByLabel("البريد الإلكتروني").fill(email)
  await page.getByLabel("كلمة المرور").fill(password)
  await page.getByRole("button", { name: "تسجيل الدخول" }).click()

  await page.waitForURL("**/ar/dashboard")
  await expect(page).toHaveURL(/\/ar\/dashboard/)

  await page.context().storageState({ path: STORAGE })
})
