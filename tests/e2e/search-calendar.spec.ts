import { expect, test } from "@playwright/test"

test.describe("البحث الشامل", () => {
  test("⌘K يفتح اللوحة ويبحث عبر كل الأقسام", async ({ page }) => {
    await page.goto("/ar/dashboard")

    await page.keyboard.press("ControlOrMeta+k")
    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()

    // نص موجود في الملاحظات التجريبية
    await page.getByPlaceholder("ابحث أو انتقل…").fill("خوارزميات")

    // يجد المهمة والواجب والملاحظة — أقساماً مختلفة في نتيجة واحدة
    await expect(dialog.getByText("إنهاء تقرير خوارزميات البحث")).toBeVisible()
    await expect(dialog.getByText("مهمة", { exact: false })).toBeVisible()
  })

  test("اختيار نتيجة ينقل لصفحتها", async ({ page }) => {
    await page.goto("/ar/dashboard")
    await page.keyboard.press("ControlOrMeta+k")

    await page.getByPlaceholder("ابحث أو انتقل…").fill("Media Downloader")
    await page.getByRole("option").filter({ hasText: "Media Downloader" }).first().click()

    await expect(page).toHaveURL(/\/ar\/projects\//)
    await expect(page.getByRole("heading", { name: "Media Downloader" })).toBeVisible()
  })

  test("بلا نص تعرض اللوحة روابط التنقّل", async ({ page }) => {
    await page.goto("/ar/dashboard")
    await page.keyboard.press("ControlOrMeta+k")

    const dialog = page.getByRole("dialog")
    await expect(dialog.getByRole("option", { name: "المهام" })).toBeVisible()
    await expect(dialog.getByRole("option", { name: "المالية" })).toBeVisible()

    await dialog.getByRole("option", { name: "المالية" }).click()
    await expect(page).toHaveURL(/\/ar\/finance/)
  })

  test("نص بلا نتائج يعرض حالة فارغة", async ({ page }) => {
    await page.goto("/ar/dashboard")
    await page.keyboard.press("ControlOrMeta+k")

    await page.getByPlaceholder("ابحث أو انتقل…").fill("نص-لا-يوجد-أبداً-xyz")
    await expect(page.getByRole("dialog").getByText("لا نتائج")).toBeVisible()
  })
})

test.describe("التقويم الموحّد", () => {
  /**
   * الاختبار يصنع مهمته بدل الاتكاء على البيانات التجريبية.
   *
   * كان يفترض أن مهمة البذرة تقع في الشهر الحالي — صحيحٌ يوم البذر
   * وخاطئ بعده بأسابيع، فانكسر الاختبار بمرور الوقت لا بتغيّر الكود.
   *
   * واليومُ نفسه لا يصلح موضعاً: خلية اليوم تعرض عدداً محدوداً من
   * الأحداث (maxPerDay) ثم «+N»، فتدفع أحداثُ اليوم مهمتَنا خارج
   * المعروض. يومٌ خالٍ قريب يجعل الاختبار يفحص ما وُضع له.
   */
  const target = new Date(Date.now() + 20 * 86_400_000)
    .toISOString()
    .slice(0, 10)
  let taskTitle: string

  test.beforeEach(async ({ page }) => {
    taskTitle = `اختبار تقويم ${Date.now()}`

    await page.goto("/ar/tasks")
    await page.getByRole("button", { name: "مهمة جديدة" }).first().click()
    const dialog = page.getByRole("dialog")
    await dialog.getByLabel("العنوان").fill(taskTitle)
    await dialog.getByLabel("تاريخ الاستحقاق").fill(target)
    await dialog.getByRole("button", { name: "إنشاء" }).click()
    await expect(dialog).toHaveCount(0)

    await page.goto("/ar/calendar")
    await expect(
      page.getByRole("heading", { name: "التقويم", exact: true })
    ).toBeVisible()
  })

  test("يجمع عناصر من أقسام مختلفة", async ({ page }) => {
    const calendar = page.getByTestId("month-calendar")
    await expect(calendar).toBeVisible()
    await expect(calendar.getByText(taskTitle)).toBeVisible()
  })

  test("التصفية بالنوع تحصر المعروض", async ({ page }) => {
    const calendar = page.getByTestId("month-calendar")
    await expect(calendar.getByText(taskTitle)).toBeVisible()

    // نحصر النطاق بشريط المرشّحات — "اختبار" يظهر أيضاً في عناوين الأحداث
    await page.locator("div.no-scrollbar").getByRole("button", { name: "اختبار" }).click()

    // المهام اختفت من العرض
    await expect(calendar.getByText(taskTitle)).toHaveCount(0)
  })

  test("التنقّل بين الشهور يعمل", async ({ page }) => {
    const heading = page.locator("h2").first()
    const current = await heading.textContent()

    await page.getByRole("button", { name: "التالي" }).click()
    await expect(heading).not.toHaveText(current ?? "")

    await page.getByRole("button", { name: "اليوم" }).click()
    await expect(heading).toHaveText(current ?? "")
  })
})
