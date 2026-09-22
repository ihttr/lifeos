import { expect, test } from "@playwright/test"

const unique = () => `ملاحظة اختبار ${Date.now()}`

test.describe("الملاحظات", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/ar/notes")
    await expect(page.getByRole("heading", { name: "الملاحظات" })).toBeVisible()
  })

  test("إنشاء ملاحظة بـ Markdown ومعاينتها ثم حذفها", async ({ page }) => {
    const title = unique()

    await page.getByRole("button", { name: "ملاحظة جديدة" }).first().click()
    await page.getByLabel("العنوان").fill(title)
    await page
      .getByLabel("المحتوى")
      .fill("## عنوان فرعي\n\n- عنصر أول\n- عنصر ثانٍ")

    // المعاينة تحوّل Markdown إلى HTML
    await page.getByRole("tab", { name: "معاينة" }).click()
    await expect(
      page.getByRole("heading", { name: "عنوان فرعي", level: 2 })
    ).toBeVisible()

    await page.getByRole("button", { name: "إنشاء" }).click()
    await expect(page.getByRole("heading", { name: title })).toBeVisible()

    // حذف
    const card = page.locator("article").filter({ hasText: title })
    await card.getByRole("button", { name: "المزيد" }).click()
    await page.getByRole("menuitem", { name: "حذف" }).click()
    await page.getByRole("button", { name: "حذف", exact: true }).last().click()

    await expect(page.getByRole("heading", { name: title })).toHaveCount(0)
  })

  test("سكربت داخل الملاحظة لا يُنفَّذ (تعقيم Markdown)", async ({ page }) => {
    const title = unique()

    await page.getByRole("button", { name: "ملاحظة جديدة" }).first().click()
    await page.getByLabel("العنوان").fill(title)
    await page
      .getByLabel("المحتوى")
      .fill('<img src=x onerror="window.__xss=true">\n\nنص عادي')

    await page.getByRole("tab", { name: "معاينة" }).click()
    await page.waitForTimeout(300)

    expect(await page.evaluate(() => "__xss" in window)).toBe(false)
  })

  test("البحث والمفضلة يصفّيان القائمة", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "أوامر Git التي أنساها دائماً" })
    ).toBeVisible()

    await page.getByRole("textbox", { name: "بحث" }).fill("A*")
    await expect(
      page.getByRole("heading", { name: /خوارزمية A\*/ })
    ).toBeVisible()
    await expect(
      page.getByRole("heading", { name: "أوامر Git التي أنساها دائماً" })
    ).toHaveCount(0)

    await page.getByRole("textbox", { name: "بحث" }).fill("")
    await page.getByRole("button", { name: "المفضلة" }).click()
    await expect(
      page.getByRole("heading", { name: "أوامر Git التي أنساها دائماً" })
    ).toBeVisible()
  })
})
