import { expect, test } from "@playwright/test"

const unique = () => `مشروع اختبار ${Date.now()}`

test.describe("المشاريع", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/ar/projects")
    await expect(page.getByRole("heading", { name: "المشاريع" })).toBeVisible()
  })

  test("إنشاء مشروع ثم فتحه وإضافة مرحلة ثم حذفه", async ({ page }) => {
    const name = unique()

    await page.getByRole("button", { name: "مشروع جديد" }).first().click()
    await page.getByLabel("الاسم").fill(name)
    await page.getByLabel("التقنيات").fill("Next.js، Prisma")
    await page.getByRole("button", { name: "إنشاء" }).click()

    const card = page.getByRole("link", { name: new RegExp(name) })
    await expect(card).toBeVisible()
    await card.click()

    await expect(page.getByRole("heading", { name })).toBeVisible()
    await expect(page.getByText("Prisma")).toBeVisible()

    // مرحلة جديدة
    await page.getByRole("tab", { name: /المراحل/ }).click()
    await page.getByPlaceholder("إضافة مرحلة").fill("أول مرحلة")
    await page.getByRole("button", { name: "إضافة مرحلة" }).click()

    const milestone = page.getByRole("checkbox", { name: "أول مرحلة" })
    await expect(milestone).toBeVisible()
    await milestone.click()
    await expect(milestone).toBeChecked()

    // التقدم صار 100% لأن المرحلة الوحيدة أُنجزت
    await expect(page.getByRole("progressbar").first()).toHaveAttribute(
      "aria-valuenow",
      "100"
    )

    // حذف
    await page.getByRole("button", { name: "حذف", exact: true }).first().click()
    await page.getByRole("button", { name: "حذف", exact: true }).last().click()

    await expect(page).toHaveURL(/\/ar\/projects$/)
    await expect(page.getByRole("link", { name: new RegExp(name) })).toHaveCount(0)
  })

  test("رابط غير صالح يُرفض", async ({ page }) => {
    await page.getByRole("button", { name: "مشروع جديد" }).first().click()
    await page.getByLabel("الاسم").fill(unique())
    await page.getByLabel("GitHub").fill("javascript:alert(1)")
    await page.getByRole("button", { name: "إنشاء" }).click()

    await expect(
      page.getByText("أدخل رابطاً صحيحاً يبدأ بـ http أو https")
    ).toBeVisible()
  })

  test("التصفية بالحالة تعمل", async ({ page }) => {
    await expect(page.getByRole("link", { name: /Media Downloader/ })).toBeVisible()

    await page.getByRole("combobox").last().click()
    await page.getByRole("option", { name: "مكتمل" }).click()

    await expect(page.getByText("لا نتائج")).toBeVisible()
  })
})
