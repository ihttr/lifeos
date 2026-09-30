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
    await card.getByRole("button", { name: `خيارات ${title}` }).click()
    await page.getByRole("menuitem", { name: "حذف" }).click()
    await page.getByRole("button", { name: "حذف" }).last().click()
    await expect(page.getByText("حُذف الملف")).toBeVisible()
    await expect(page.locator("li").filter({ hasText: title })).toHaveCount(0)
  })

  test("تعديل البيانات لا يمسّ الملف", async ({ page }) => {
    const title = `أرشيف تعديل ${Date.now()}`
    await upload(page, title)

    const card = page.locator("li").filter({ hasText: title })
    await card.getByRole("button", { name: `خيارات ${title}` }).click()
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

// ------------------------------------------------------------------ الصيغ

test.describe("صيغ الملفات", () => {
  /** المتصفح يعطي `.py` نوعاً فارغاً — النوع يُحسم بالامتداد لا به */
  async function uploadRaw(
    page: import("@playwright/test").Page,
    name: string,
    body: string
  ) {
    await page.goto("/ar/archive")
    await page.getByRole("button", { name: "رفع ملف" }).first().click()

    const dialog = page.getByRole("dialog")
    await dialog.locator("#archive-file").setInputFiles({
      name,
      mimeType: "",
      buffer: Buffer.from(body),
    })
    await dialog.getByRole("button", { name: "رفع ملف" }).click()
    await expect(page.getByText("رُفع الملف")).toBeVisible()
  }

  test("ملف بايثون يُعرض نصّاً لا يُنزَّل قسراً", async ({ page, context }) => {
    const title = `أرشيف بايثون ${Date.now()}`
    await uploadRaw(page, `${title}.py`, "print('مرحبا')\n")

    const href = await page
      .locator("li")
      .filter({ hasText: title })
      .getByRole("link")
      .first()
      .getAttribute("href")

    const response = await context.request.get(href!)
    // لولا الكشف بالامتداد لكان octet-stream فيُنزَّل بدل أن يُعرض
    expect(response.headers()["content-type"]).toContain("text/plain")
    expect((await response.body()).toString()).toContain("مرحبا")
  })

  test("التنزيل يحمل الاسم الأصلي بامتداده", async ({ page, context }) => {
    const title = `أرشيف امتداد ${Date.now()}`
    await uploadRaw(page, `${title}.py`, "x = 1\n")

    const href = await page
      .locator("li")
      .filter({ hasText: title })
      .getByRole("link")
      .first()
      .getAttribute("href")

    const response = await context.request.get(href!)
    // العنوان يُزال منه الامتداد، فلولا حفظ الاسم لنزل الملف بلا امتداد
    expect(response.headers()["content-disposition"]).toContain(
      encodeURIComponent(`${title}.py`)
    )
  })

  test("HTML يُقدَّم نصّاً لا صفحةً — منع XSS مخزّن", async ({
    page,
    context,
  }) => {
    const title = `أرشيف صفحة ${Date.now()}`
    await uploadRaw(page, `${title}.html`, "<script>alert(1)</script>")

    const href = await page
      .locator("li")
      .filter({ hasText: title })
      .getByRole("link")
      .first()
      .getAttribute("href")

    const response = await context.request.get(href!)
    // تقديمه text/html يعني تنفيذ سكربت المستخدم داخل أصل الموقع
    expect(response.headers()["content-type"]).toContain("text/plain")
    expect(response.headers()["content-type"]).not.toContain("text/html")
  })
})

// ------------------------------------------------------------------ المجلدات

test.describe("المجلدات", () => {
  async function newFolder(page: import("@playwright/test").Page, name: string) {
    await page.getByRole("button", { name: "مجلد جديد" }).click()
    const dialog = page.getByRole("dialog")
    await dialog.locator("#folder-name").fill(name)
    await dialog.getByRole("button", { name: "إنشاء" }).click()
    await expect(page.getByText("أُنشئ المجلد")).toBeVisible()
  }

  test("إنشاء مجلد ثم الدخول إليه والرفع بداخله", async ({ page }) => {
    const folder = `مجلد ${Date.now()}`
    const title = `أرشيف داخل ${Date.now()}`

    await page.goto("/ar/archive")
    await newFolder(page, folder)

    // الدخول
    await page.getByRole("button", { name: folder, exact: true }).click()
    await expect(
      page.getByRole("navigation", { name: "مسار المجلدات" })
    ).toContainText(folder)

    // الرفع يقع داخل المجلد المعروض
    await page.getByRole("button", { name: "رفع ملف" }).first().click()
    const dialog = page.getByRole("dialog")
    await dialog.locator("#archive-file").setInputFiles({
      name: `${title}.pdf`,
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\n%%EOF"),
    })
    await dialog.getByRole("button", { name: "رفع ملف" }).click()
    await expect(page.getByText("رُفع الملف")).toBeVisible()
    await expect(page.locator("li").filter({ hasText: title })).toBeVisible()

    // وفي الجذر لا يظهر
    await page.getByRole("button", { name: "الأرشيف", exact: true }).click()
    await expect(page.locator("li").filter({ hasText: title })).toHaveCount(0)
  })

  test("البحث يتجاوز المجلدات", async ({ page }) => {
    const folder = `مجلد بحث ${Date.now()}`
    const title = `أرشيف مخفي ${Date.now()}`

    await page.goto("/ar/archive")
    await newFolder(page, folder)
    await page.getByRole("button", { name: folder, exact: true }).click()

    const dialog = page.getByRole("dialog")
    await page.getByRole("button", { name: "رفع ملف" }).first().click()
    await dialog.locator("#archive-file").setInputFiles({
      name: `${title}.pdf`,
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\n%%EOF"),
    })
    await dialog.getByRole("button", { name: "رفع ملف" }).click()
    await expect(page.getByText("رُفع الملف")).toBeVisible()

    // من الجذر: التصفّح لا يُظهره، لكن البحث يجده
    await page.getByRole("button", { name: "الأرشيف", exact: true }).click()
    await expect(page.locator("li").filter({ hasText: title })).toHaveCount(0)

    await page.getByPlaceholder("ابحث في العناوين").fill(title)
    await expect(page.locator("li").filter({ hasText: title })).toBeVisible()
    await expect(page.getByText("البحث يشمل كل المجلدات")).toBeVisible()
  })

  test("حذف المجلد يرفع محتواه للأب ولا يحذف ملفاً", async ({ page }) => {
    const folder = `مجلد يُحذف ${Date.now()}`
    const title = `أرشيف ناجٍ ${Date.now()}`

    await page.goto("/ar/archive")
    await newFolder(page, folder)
    await page.getByRole("button", { name: folder, exact: true }).click()

    await page.getByRole("button", { name: "رفع ملف" }).first().click()
    const dialog = page.getByRole("dialog")
    await dialog.locator("#archive-file").setInputFiles({
      name: `${title}.pdf`,
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\n%%EOF"),
    })
    await dialog.getByRole("button", { name: "رفع ملف" }).click()
    await expect(page.getByText("رُفع الملف")).toBeVisible()

    // حذف المجلد من الجذر
    await page.getByRole("button", { name: "الأرشيف", exact: true }).click()
    await page
      .getByRole("button", { name: `خيارات مجلد ${folder}` })
      .click()
    await page.getByRole("menuitem", { name: "حذف" }).click()
    await page.getByRole("button", { name: "حذف" }).last().click()
    await expect(page.getByText("حُذف المجلد")).toBeVisible()

    // الملف نجا وصعد للجذر
    await expect(page.locator("li").filter({ hasText: title })).toBeVisible()
  })

  test("نقل ملف بين المجلدات", async ({ page }) => {
    const folder = `مجلد وجهة ${Date.now()}`
    const title = `أرشيف منقول ${Date.now()}`

    await page.goto("/ar/archive")
    await newFolder(page, folder)

    await page.getByRole("button", { name: "رفع ملف" }).first().click()
    const dialog = page.getByRole("dialog")
    await dialog.locator("#archive-file").setInputFiles({
      name: `${title}.pdf`,
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\n%%EOF"),
    })
    await dialog.getByRole("button", { name: "رفع ملف" }).click()
    await expect(page.getByText("رُفع الملف")).toBeVisible()

    await page
      .locator("li")
      .filter({ hasText: title })
      .getByRole("button", { name: `خيارات ${title}` })
      .click()
    await page.getByRole("menuitem", { name: "نقل إلى" }).click()
    await page.getByRole("dialog").getByRole("button", { name: folder }).click()
    await expect(page.getByText("نُقل الملف")).toBeVisible()

    // خرج من الجذر ودخل المجلد
    await expect(page.locator("li").filter({ hasText: title })).toHaveCount(0)
    await page.getByRole("button", { name: folder, exact: true }).click()
    await expect(page.locator("li").filter({ hasText: title })).toBeVisible()
  })
})
