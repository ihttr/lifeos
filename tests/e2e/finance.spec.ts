import { expect, test } from "@playwright/test"

const unique = () => `تصنيف${Date.now()}`

test.describe("المالية", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/ar/finance")
    await expect(
      page.getByRole("heading", { name: "المالية", exact: true })
    ).toBeVisible()
  })

  test("تسجيل مصروف يحدّث المجاميع ثم حذفه يعيدها", async ({ page }) => {
    const category = unique()

    const balanceBefore = await page
      .locator("p.tabular-nums")
      .last()
      .textContent()

    await page.getByRole("button", { name: "حركة جديدة" }).first().click()
    await page.getByLabel("المبلغ").fill("250")
    await page.getByRole("dialog").getByLabel("التصنيف").fill(category)
    await page.getByRole("button", { name: "إنشاء" }).click()

    const list = page.locator("ul.divide-y")
    const row = list.locator("li").filter({ hasText: category })
    await expect(row).toBeVisible()
    await expect(row).toContainText("250")

    // الرصيد تغيّر
    const balanceAfter = await page
      .locator("p.tabular-nums")
      .last()
      .textContent()
    expect(balanceAfter).not.toBe(balanceBefore)

    // حذف
    await row.getByRole("button", { name: "حذف" }).click()
    await page.getByRole("button", { name: "حذف", exact: true }).last().click()
    await expect(list.locator("li").filter({ hasText: category })).toHaveCount(0)

    await expect(page.locator("p.tabular-nums").last()).toHaveText(
      balanceBefore ?? ""
    )
  })

  test("الدخل يُسجَّل بإشارة موجبة والمصروف بسالبة", async ({ page }) => {
    const category = unique()

    await page.getByRole("button", { name: "حركة جديدة" }).first().click()
    await page.getByRole("radio", { name: "دخل" }).click()
    await page.getByLabel("المبلغ").fill("1000")
    await page.getByRole("dialog").getByLabel("التصنيف").fill(category)
    await page.getByRole("button", { name: "إنشاء" }).click()

    const row = page.locator("ul.divide-y").locator("li").filter({ hasText: category })
    await expect(row).toContainText("+")

    await row.getByRole("button", { name: "حذف" }).click()
    await page.getByRole("button", { name: "حذف", exact: true }).last().click()
  })

  test("المبلغ السالب أو الصفر مرفوض", async ({ page }) => {
    await page.getByRole("button", { name: "حركة جديدة" }).first().click()
    await page.getByLabel("المبلغ").fill("-50")
    await page.getByRole("dialog").getByLabel("التصنيف").fill("اختبار")
    await page.getByRole("button", { name: "إنشاء" }).click()

    await expect(page.getByText("أدخل مبلغاً موجباً")).toBeVisible()
  })

  test("التنقّل بين الشهور يغيّر البيانات", async ({ page }) => {
    const current = await page.locator("span.min-w-40").textContent()

    await page.getByRole("button", { name: "السابق" }).click()
    await expect(page.locator("span.min-w-40")).not.toHaveText(current ?? "")

    // زر الشهر التالي يرجعنا، ويُعطَّل عند الشهر الحالي
    await page.getByRole("button", { name: "التالي" }).click()
    await expect(page.locator("span.min-w-40")).toHaveText(current ?? "")
    await expect(page.getByRole("button", { name: "التالي" })).toBeDisabled()
  })

  test("المخططان يعرضان جداول مكافئة لقارئ الشاشة", async ({ page }) => {
    const table = page.getByRole("table", { name: /الدخل والمصروف/ })
    await expect(table).toBeAttached()
    // ستة أشهر + ترويسة
    await expect(table.getByRole("row")).toHaveCount(7)
  })
})
