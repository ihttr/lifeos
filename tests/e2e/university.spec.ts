import { expect, test } from "@playwright/test"

const unique = (prefix: string) => `${prefix} اختبار ${Date.now()}`

test.describe("الجامعة", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/ar/university")
    await expect(page.getByRole("heading", { name: "الجامعة" })).toBeVisible()
  })

  test("إضافة مادة ثم واجب لها ثم إنجازه ثم حذفهما", async ({ page }) => {
    const subject = unique("مادة")
    const assignment = unique("واجب")

    // مادة جديدة
    await page.getByRole("button", { name: "مادة جديدة" }).click()
    await page.getByLabel("اسم المادة").fill(subject)
    await page.getByLabel("الرمز").fill("TST101")
    await page.getByLabel("الساعات").fill("4")
    await page.getByRole("button", { name: "إنشاء" }).click()

    const card = page.locator("article").filter({ hasText: subject })
    await expect(card).toBeVisible()
    await expect(card).toContainText("TST101")
    await expect(card).toContainText("4 ساعات") // أرقام لاتينية دائماً

    // واجب لهذه المادة
    await page.getByRole("tab", { name: /الواجبات/ }).click()
    await page.getByRole("button", { name: "واجب جديد" }).click()
    await page.getByLabel("عنوان الواجب").fill(assignment)
    // نحصر النطاق بالنافذة: فلتر المادة في الخلفية يحمل نفس التسمية
    const dialog = page.getByRole("dialog")
    await dialog.getByLabel("المادة").click()
    await page.getByRole("option", { name: subject }).click()
    await page.getByLabel("تاريخ الاستحقاق").fill("2027-05-20")
    await page.getByRole("button", { name: "إنشاء" }).click()

    const row = page.locator("li").filter({ hasText: assignment })
    await expect(row).toBeVisible()

    // إنجاز الواجب
    const box = page.getByRole("checkbox", { name: assignment, exact: true })
    await box.click()
    await expect(box).toBeChecked()

    // حذف الواجب ثم المادة
    await row.getByRole("button", { name: "حذف" }).click()
    await page.getByRole("button", { name: "حذف", exact: true }).last().click()
    await expect(page.locator("li").filter({ hasText: assignment })).toHaveCount(0)

    await page.getByRole("tab", { name: "المواد" }).click()
    await page
      .locator("article")
      .filter({ hasText: subject })
      .getByRole("button", { name: "المزيد" })
      .click()
    await page.getByRole("menuitem", { name: "حذف" }).click()
    await page.getByRole("button", { name: "حذف", exact: true }).last().click()

    await expect(page.locator("article").filter({ hasText: subject })).toHaveCount(0)
  })

  test("الواجب يحتاج عنواناً وتاريخاً", async ({ page }) => {
    await page.getByRole("tab", { name: /الواجبات/ }).click()
    await page.getByRole("button", { name: "واجب جديد" }).click()

    await page.getByLabel("عنوان الواجب").fill("   ")
    await page.getByRole("button", { name: "إنشاء" }).click()

    await expect(page.getByText("هذا الحقل مطلوب")).toBeVisible()
  })

  test("الاختبار يُضاف ويظهر في التقويم", async ({ page }) => {
    const title = unique("اختبار")

    await page.getByRole("tab", { name: "الاختبارات" }).click()
    await page.getByRole("button", { name: "اختبار جديد" }).click()
    await page.getByLabel("عنوان الاختبار").fill(title)
    await page.getByLabel("التاريخ").fill("2027-05-12")
    await page.getByLabel("المكان").fill("قاعة ١٠١")
    await page.getByLabel("الوزن").fill("40")
    await page.getByRole("button", { name: "إنشاء" }).click()

    const card = page.locator("li").filter({ hasText: title })
    await expect(card).toBeVisible()
    await expect(card).toContainText("قاعة ١٠١")
    await expect(card).toContainText("40%")

    // يظهر في تقويم الشهر نفسه
    await page.getByRole("tab", { name: "التقويم" }).click()
    await page.goto("/ar/university?tab=calendar&month=2027-05")
    await expect(
      page.getByTestId("month-calendar").getByText(title)
    ).toBeVisible()

    // تنظيف
    await page.getByRole("tab", { name: "الاختبارات" }).click()
    await page
      .locator("li")
      .filter({ hasText: title })
      .getByRole("button", { name: "حذف" })
      .click()
    await page.getByRole("button", { name: "حذف", exact: true }).last().click()
    await expect(page.locator("li").filter({ hasText: title })).toHaveCount(0)
  })

  test("التصفية بالمادة تعمل", async ({ page }) => {
    await page.getByRole("tab", { name: /الواجبات/ }).click()

    await expect(page.getByText("تقرير خوارزميات البحث")).toBeVisible()

    await page.getByLabel("المادة", { exact: true }).click()
    await page.getByRole("option", { name: "الشبكات" }).click()

    await expect(page.getByText("تقرير خوارزميات البحث")).toHaveCount(0)
    await expect(page.getByText("مشروع تصميم شبكة فرعية")).toBeVisible()
  })

  test("التبديل بين الفصول يغيّر المواد المعروضة", async ({ page }) => {
    await expect(page.getByText("الذكاء الاصطناعي")).toBeVisible()

    await page.getByLabel("الفصل الدراسي").click()
    await page.getByRole("option", { name: /الفصل الأول/ }).click()

    // الفصل السابق في البيانات التجريبية بلا مواد
    await expect(page.getByText("لا مواد في هذا الفصل")).toBeVisible()
  })
})
