import { expect, test } from "@playwright/test"

const unique = () => `اختبار ${Date.now()}-${Math.floor(Math.random() * 1000)}`

/**
 * ملاحظة: مربّعات الاختيار مضبوطة بالخادم (controlled)،
 * فلا تتغيّر حالتها إلا بعد رحلة الذهاب والإياب.
 * لذلك نستخدم click() ثم توقّعاً يعيد المحاولة، لا check().
 */

test.describe("المهام", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/ar/tasks")
    await expect(page.getByRole("heading", { name: "المهام" })).toBeVisible()
  })

  async function createTask(page: import("@playwright/test").Page, title: string) {
    await page.getByRole("button", { name: "مهمة جديدة" }).first().click()
    await page.getByLabel("العنوان").fill(title)
    await page.getByRole("button", { name: "إنشاء" }).click()
    await expect(page.getByRole("button", { name: title, exact: true })).toBeVisible()
  }

  test("إنشاء ثم تعديل ثم إنجاز ثم حذف مهمة", async ({ page }) => {
    const title = unique()
    const renamed = `${title} معدّلة`

    await createTask(page, title)

    // تعديل
    await page.getByRole("button", { name: title, exact: true }).click()
    await page.getByLabel("العنوان").fill(renamed)
    await page.getByRole("button", { name: "حفظ" }).click()
    await expect(
      page.getByRole("button", { name: renamed, exact: true })
    ).toBeVisible()

    // إنجاز
    const checkbox = page.getByRole("checkbox", { name: renamed, exact: true })
    await checkbox.click()
    await expect(checkbox).toBeChecked()

    // حذف
    const row = page.locator("li").filter({ hasText: renamed })
    await row.getByRole("button", { name: "المزيد" }).click()
    await page.getByRole("menuitem", { name: "حذف" }).click()
    await page.getByRole("button", { name: "حذف", exact: true }).last().click()

    await expect(
      page.getByRole("button", { name: renamed, exact: true })
    ).toHaveCount(0)
  })

  test("العنوان الفارغ لا يُنشئ مهمة", async ({ page }) => {
    await page.getByRole("button", { name: "مهمة جديدة" }).first().click()
    await page.getByLabel("العنوان").fill("   ")
    await page.getByRole("button", { name: "إنشاء" }).click()

    await expect(page.getByText("هذا الحقل مطلوب")).toBeVisible()
  })

  test("البحث يصفّي القائمة", async ({ page }) => {
    const title = unique()
    await createTask(page, title)

    await page.getByRole("textbox", { name: "بحث" }).fill(title)
    await expect(
      page.getByRole("button", { name: title, exact: true })
    ).toBeVisible()

    await page.getByRole("textbox", { name: "بحث" }).fill("لا-يوجد-هذا-النص-أبداً")
    await expect(page.getByText("لا توجد مهام بعد")).toBeVisible()
  })

  test("التبديل بين القائمة واللوحة والتقويم", async ({ page }) => {
    await page.getByRole("radio", { name: "لوحة" }).click()
    await expect(page.getByTestId("task-board")).toBeVisible()

    await page.getByRole("radio", { name: "تقويم" }).click()
    await expect(page.getByTestId("month-calendar")).toBeVisible()

    await page.getByRole("radio", { name: "قائمة" }).click()
    await expect(page.getByTestId("task-board")).toHaveCount(0)
  })

  test("المهام الفرعية تُضاف وتُنجز", async ({ page }) => {
    const title = unique()
    const subtask = `خطوة ${Date.now()}`

    await createTask(page, title)
    await page.getByRole("button", { name: title, exact: true }).click()

    await page.getByPlaceholder("إضافة مهمة فرعية").fill(subtask)
    await page.getByRole("button", { name: "إضافة مهمة فرعية" }).click()

    const box = page.getByRole("checkbox", { name: subtask, exact: true })
    await expect(box).toBeVisible()

    await box.click()
    await expect(box).toBeChecked()
    // العدّاد داخل النافذة تحديداً — القائمة خلفها قد تحوي عدّادات مشابهة
    await expect(page.getByRole("dialog").getByText("1/1")).toBeVisible()
  })

  test("الأولوية والموعد يُحفظان ويظهران في القائمة", async ({ page }) => {
    const title = unique()

    await page.getByRole("button", { name: "مهمة جديدة" }).first().click()
    await page.getByLabel("العنوان").fill(title)

    await page.getByLabel("الأولوية").click()
    await page.getByRole("option", { name: "عاجلة" }).click()

    await page.getByLabel("تاريخ الاستحقاق").fill("2027-03-15")
    await page.getByRole("button", { name: "إنشاء" }).click()

    await page.getByRole("button", { name: title, exact: true }).click()
    await expect(page.getByLabel("تاريخ الاستحقاق")).toHaveValue("2027-03-15")
    await expect(page.getByLabel("الأولوية")).toContainText("عاجلة")
  })
})
