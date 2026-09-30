import { expect, test } from "@playwright/test"

/**
 * الأرشيف — رفع، فتح، تعديل، تصفية، حذف.
 *
 * الرفع يمرّ بالسائق المحلي (لا مخزن Blob في التطوير)، لكن ما فوقه —
 * المسار المحمي، والتحقق من الملكية، والفلاتر — هو نفسه في الإنتاج.
 */

/** ملف PDF صغير صالح البنية — يكفي للتحقق من دورة الرفع والفتح */
function pdfFile(name: string) {
  return {
    name,
    mimeType: "application/pdf",
    buffer: Buffer.from(
      "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF"
    ),
  }
}

async function upload(
  page: import("@playwright/test").Page,
  title: string,
  { kind }: { kind?: string } = {}
) {
  await page.goto("/ar/archive")
  await page.getByRole("button", { name: "رفع ملف" }).first().click()

  const dialog = page.getByRole("dialog")
  await dialog.locator("#archive-file").setInputFiles(pdfFile(`${title}.pdf`))

  // العنوان يُملأ تلقائياً من اسم الملف — نتأكد ثم نثبّته
  await expect(dialog.locator("#archive-title")).toHaveValue(title)

  if (kind) {
    await dialog.locator("#archive-kind").click()
    await page.getByRole("option", { name: kind, exact: true }).click()
  }

  await dialog.getByRole("button", { name: "رفع ملف" }).click()
  await expect(page.getByText("رُفع الملف")).toBeVisible()
}

test.describe("الأرشيف", () => {
  test("رفع ملف ثم فتحه ثم حذفه", async ({ page, context }) => {
    const title = `أرشيف اختبار ${Date.now()}`
    await upload(page, title)

    const card = page.locator("li").filter({ hasText: title })
    await expect(card).toBeVisible()
    // ٦٨ بايت — أصغر من كيلو، فيُعرض بالبايت
    await expect(card).toContainText("68 B")

    // الفتح يمرّ بالمسار المحمي ويعيد الملف فعلاً
    const link = card.getByRole("link", { name: title })
    const href = await link.getAttribute("href")
    expect(href).toMatch(/^\/api\/archive\/c/)

    const response = await context.request.get(href!)
    expect(response.status()).toBe(200)
    expect(response.headers()["content-type"]).toContain("application/pdf")
    // المحتوى يعود كما رُفع لا مجرد استجابة ناجحة
    expect((await response.body()).toString()).toContain("%PDF-1.4")

    // الحذف
    await card.getByRole("button", { name: title }).click()
    await page.getByRole("menuitem", { name: "حذف" }).click()
    await page.getByRole("button", { name: "حذف" }).last().click()
    await expect(page.getByText("حُذف الملف")).toBeVisible()
    await expect(page.locator("li").filter({ hasText: title })).toHaveCount(0)
  })

  test("تعديل البيانات لا يمسّ الملف", async ({ page }) => {
    const title = `أرشيف تعديل ${Date.now()}`
    await upload(page, title)

    const card = page.locator("li").filter({ hasText: title })
    await card.getByRole("button", { name: title }).click()
    await page.getByRole("menuitem", { name: "تعديل" }).click()

    const dialog = page.getByRole("dialog")
    // حقل الملف يختفي عند التعديل — الاستبدال عملية أخرى
    await expect(dialog.locator("#archive-file")).toHaveCount(0)

    await dialog.locator("#archive-description").fill("وصف مضاف بعد الرفع")
    await dialog.getByRole("button", { name: "حفظ" }).click()
    await expect(page.getByText("حُدّثت البيانات")).toBeVisible()

    await expect(
      page.locator("li").filter({ hasText: title })
    ).toContainText("وصف مضاف بعد الرفع")
  })

  test("البحث والتصفية بالنوع", async ({ page }) => {
    const stamp = Date.now()
    await upload(page, `أرشيف نظري ${stamp}`, { kind: "نظري" })
    await upload(page, `أرشيف عملي ${stamp}`, { kind: "عملي" })

    // البحث النصّي
    await page.getByPlaceholder("ابحث في العناوين").fill(`أرشيف عملي ${stamp}`)
    await expect(page.locator("li").filter({ hasText: `${stamp}` })).toHaveCount(1)

    await page.getByPlaceholder("ابحث في العناوين").fill("")

    // التصفية بالنوع
    await page.getByLabel("النوع").click()
    await page.getByRole("option", { name: "نظري", exact: true }).click()

    await expect(page.locator("li").filter({ hasText: `أرشيف نظري ${stamp}` })).toBeVisible()
    await expect(
      page.locator("li").filter({ hasText: `أرشيف عملي ${stamp}` })
    ).toHaveCount(0)
  })

  test("ربط الملف بمادة يظهر في البطاقة", async ({ page }) => {
    const title = `أرشيف مادة ${Date.now()}`
    await page.goto("/ar/archive")
    await page.getByRole("button", { name: "رفع ملف" }).first().click()

    const dialog = page.getByRole("dialog")
    await dialog.locator("#archive-file").setInputFiles(pdfFile(`${title}.pdf`))
    await dialog.locator("#archive-subject").click()
    await page.getByRole("option", { name: "الشبكات", exact: true }).click()
    await dialog.getByRole("button", { name: "رفع ملف" }).click()
    await expect(page.getByText("رُفع الملف")).toBeVisible()

    await expect(page.locator("li").filter({ hasText: title })).toContainText(
      "الشبكات"
    )
  })
})

test.describe("أمان الأرشيف", () => {
  test("بلا جلسة لا يُقدَّم الملف", async ({ page, browser }) => {
    const title = `أرشيف خاص ${Date.now()}`
    await upload(page, title)

    const href = await page
      .locator("li")
      .filter({ hasText: title })
      .getByRole("link", { name: title })
      .getAttribute("href")

    // سياق جديد بلا كوكي الجلسة
    const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const response = await anon.request.get(href!, { maxRedirects: 0 })

    // إعادة توجيه لتسجيل الدخول أو رفض — المهم ألا يُسلَّم الملف
    expect(response.status()).not.toBe(200)
    expect(response.headers()["content-type"] ?? "").not.toContain("pdf")

    await anon.close()
  })

  test("معرّف غير موجود يعطي 404 لا خطأ خادم", async ({ context }) => {
    const response = await context.request.get(
      "/api/archive/clxxxxxxxxxxxxxxxxxxxxxxx"
    )
    expect(response.status()).toBe(404)
  })
})
