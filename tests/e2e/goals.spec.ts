import { expect, test } from "@playwright/test"

const unique = () => `هدف اختبار ${Date.now()}`

test.describe("الأهداف", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/ar/goals")
    await expect(page.getByRole("heading", { name: "الأهداف" })).toBeVisible()
  })

  test("إنشاء هدف ثم إضافة مراحله وإنجازها يكمله تلقائياً", async ({ page }) => {
    const title = unique()

    await page.getByRole("button", { name: "هدف جديد" }).first().click()
    // نحصر النطاق بالنافذة: فلتر التصنيف في الخلفية يحمل نفس التسمية
    const dialog = page.getByRole("dialog")
    await dialog.getByLabel("الهدف").fill(title)
    await dialog.getByLabel("التصنيف").fill("اختبار")
    await page.getByRole("button", { name: "إنشاء" }).click()

    const card = page.locator("article").filter({ hasText: title })
    await expect(card).toBeVisible()
    await expect(card).toContainText("نشط")

    // مرحلتان
    for (const milestone of ["مرحلة أولى", "مرحلة ثانية"]) {
      await card.getByPlaceholder("إضافة مرحلة").fill(milestone)
      await card.getByRole("button", { name: "إضافة مرحلة" }).click()
      await expect(card.getByText(milestone)).toBeVisible()
    }

    // إنجاز الأولى: التقدم نصف
    await card.getByRole("checkbox", { name: "مرحلة أولى" }).click()
    await expect(card.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "50"
    )
    await expect(card).toContainText("نشط")

    // إنجاز الثانية: الهدف يكتمل من نفسه
    await card.getByRole("checkbox", { name: "مرحلة ثانية" }).click()
    await expect(card.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "100"
    )
    await expect(card).toContainText("مكتمل")

    // إلغاء مرحلة يعيده نشطاً
    await card.getByRole("checkbox", { name: "مرحلة ثانية" }).click()
    await expect(card).toContainText("نشط")

    // حذف
    await card.getByRole("button", { name: "المزيد" }).click()
    await page.getByRole("menuitem", { name: "حذف" }).click()
    await page.getByRole("button", { name: "حذف", exact: true }).last().click()
    await expect(page.locator("article").filter({ hasText: title })).toHaveCount(0)
  })

  test("الإيقاف المؤقت والاستئناف", async ({ page }) => {
    const card = page.locator("article").filter({ hasText: "إتقان TypeScript" })
    await expect(card).toBeVisible()

    await card.getByRole("button", { name: "المزيد" }).click()
    await page.getByRole("menuitem", { name: "إيقاف مؤقت" }).click()
    await expect(card).toContainText("متوقف")

    await card.getByRole("button", { name: "المزيد" }).click()
    await page.getByRole("menuitem", { name: "استئناف" }).click()
    await expect(card).toContainText("نشط")
  })

  test("التصفية بالحالة تعمل", async ({ page }) => {
    await expect(page.getByText("إتقان TypeScript")).toBeVisible()

    await page.getByLabel("الحالة").click()
    await page.getByRole("option", { name: "مكتمل" }).click()

    await expect(page.getByText("إتقان TypeScript")).toHaveCount(0)
  })

  test("الهدف يحتاج عنواناً", async ({ page }) => {
    await page.getByRole("button", { name: "هدف جديد" }).first().click()
    await page.getByLabel("الهدف").fill("   ")
    await page.getByRole("button", { name: "إنشاء" }).click()

    await expect(page.getByText("هذا الحقل مطلوب")).toBeVisible()
  })
})
