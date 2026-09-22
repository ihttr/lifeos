import { expect, test } from "@playwright/test"

/**
 * تخصيص لوحة التحكم.
 * كل اختبار يعيد الترتيب للافتراضي في النهاية حتى لا يؤثر على غيره.
 */

async function resetToDefaults(page: import("@playwright/test").Page) {
  await page.goto("/ar/settings")
  await page.getByRole("button", { name: "الافتراضي" }).click()
  await page.getByRole("button", { name: "حفظ", exact: true }).last().click()
  await expect(page.getByText("حُفظ ترتيب اللوحة")).toBeVisible()
}

test.describe("تخصيص لوحة التحكم", () => {
  test.afterEach(async ({ page }) => {
    await resetToDefaults(page)
  })

  test("إخفاء بطاقة يزيلها من اللوحة، وإظهارها يعيدها", async ({ page }) => {
    await page.goto("/ar/dashboard")
    await expect(page.getByRole("heading", { name: "الأهداف" })).toBeVisible()

    // إخفاء بطاقة الأهداف
    await page.goto("/ar/settings")
    const row = page.locator("li").filter({ hasText: "أقرب ثلاثة أهداف" })
    await row.getByRole("switch").click()
    await page.getByRole("button", { name: "حفظ", exact: true }).last().click()
    await expect(page.getByText("حُفظ ترتيب اللوحة")).toBeVisible()

    await page.goto("/ar/dashboard")
    await expect(page.getByRole("heading", { name: "الأهداف" })).toHaveCount(0)

    // إعادتها
    await page.goto("/ar/settings")
    await page
      .locator("li")
      .filter({ hasText: "أقرب ثلاثة أهداف" })
      .getByRole("switch")
      .click()
    await page.getByRole("button", { name: "حفظ", exact: true }).last().click()

    await page.goto("/ar/dashboard")
    await expect(page.getByRole("heading", { name: "الأهداف" })).toBeVisible()
  })

  test("إظهار بطاقة غير افتراضية يعرضها في اللوحة", async ({ page }) => {
    await page.goto("/ar/dashboard")
    await expect(page.getByRole("heading", { name: "المالية" })).toHaveCount(0)

    await page.goto("/ar/settings")
    await page
      .locator("li")
      .filter({ hasText: "رصيد الشهر الحالي" })
      .getByRole("switch")
      .click()
    await page.getByRole("button", { name: "حفظ", exact: true }).last().click()
    await expect(page.getByText("حُفظ ترتيب اللوحة")).toBeVisible()

    await page.goto("/ar/dashboard")
    await expect(page.getByRole("heading", { name: "المالية" })).toBeVisible()
    await expect(page.getByText("رصيد هذا الشهر")).toBeVisible()
  })

  test("الترتيب يُحفظ ويظهر على اللوحة", async ({ page }) => {
    await page.goto("/ar/settings")

    // نقل "القادم" لأول القائمة بزر الأعلى — بديل السحب
    const up = page.getByRole("button", { name: /تحريك القادم للأعلى/ })
    await up.click()
    await up.click()
    await expect(up).toBeDisabled() // صار الأول

    await expect(page.getByText("تغييرات غير محفوظة")).toBeVisible()
    await page.getByRole("button", { name: "حفظ", exact: true }).last().click()
    await expect(page.getByText("حُفظ ترتيب اللوحة")).toBeVisible()

    // بعد إعادة التحميل يبقى الترتيب — والقادم صار أول عنوان في اللوحة
    await page.goto("/ar/dashboard")
    const firstHeading = page.locator("main h2").first()
    await expect(firstHeading).toHaveText("القادم")
  })

  test("زر الحفظ معطّل قبل أي تغيير", async ({ page }) => {
    await page.goto("/ar/settings")
    await expect(
      page.getByRole("button", { name: "حفظ", exact: true }).last()
    ).toBeDisabled()
  })
})
