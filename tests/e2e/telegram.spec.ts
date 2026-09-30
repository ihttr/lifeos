import { createServer, type Server } from "node:http"

import { expect, test } from "@playwright/test"

/**
 * بوت تيليجرام — من الـ webhook إلى قاعدة البيانات والعكس.
 *
 * نشغّل خادماً وهمياً يقلّد api.telegram.org ويسجّل ما وصله، ويوجّهه إليه
 * TELEGRAM_API_BASE في .env. هكذا نتحقق من النص والأزرار التي *كان* البوت
 * سيرسلها فعلاً، دون بوت حقيقي ودون إرسال شيء لأحد.
 *
 * يتخطّى نفسه إن لم تكن القاعدة محلية، حتى لا يراسل أحداً بالخطأ.
 */

const API_BASE = process.env.TELEGRAM_API_BASE ?? ""
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET ?? ""
const CHAT_ID = Number(process.env.TELEGRAM_CHAT_ID ?? 0)
const CRON_SECRET = process.env.CRON_SECRET ?? ""

const isLocalMock = /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(API_BASE)

type Call = { method: string; body: Record<string, unknown> }

/** ما يعيده الخادم الوهمي حين ينزّل البوت ملفاً */
const BOT_PDF = Buffer.from("%PDF-1.4\n% ملف من البوت\n%%EOF")

let server: Server
let calls: Call[] = []
let nextMessageId = 1000

test.beforeAll(async () => {
  test.skip(
    !isLocalMock || !SECRET || !CHAT_ID,
    "يحتاج TELEGRAM_API_BASE محلياً و TELEGRAM_WEBHOOK_SECRET و TELEGRAM_CHAT_ID"
  )

  const port = Number(new URL(API_BASE).port)

  server = createServer((request, response) => {
    const url = request.url ?? ""

    // نطاق تنزيل الملفات يختلف عن نطاق الـ API: /file/bot<token>/<path>
    if (url.startsWith("/file/bot")) {
      response.writeHead(200, { "Content-Type": "application/pdf" })
      response.end(BOT_PDF)
      return
    }

    const chunks: Buffer[] = []
    request.on("data", (chunk: Buffer) => chunks.push(chunk))
    request.on("end", () => {
      const method = url.split("/").pop() ?? ""
      const body = JSON.parse(Buffer.concat(chunks).toString() || "{}")
      calls.push({ method, body })

      response.writeHead(200, { "Content-Type": "application/json" })
      response.end(
        JSON.stringify({
          ok: true,
          result:
            method === "getFile"
              ? { file_id: body.file_id, file_path: "documents/bot-file.pdf" }
              : { message_id: nextMessageId++, date: 0, chat: { id: CHAT_ID } },
        })
      )
    })
  })

  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve))
})

test.afterAll(async () => {
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()))
})

test.beforeEach(() => {
  calls = []
})

/** يرسل تحديثاً للـ webhook كما يفعل تيليجرام */
async function send(
  request: import("@playwright/test").APIRequestContext,
  update: unknown,
  secret = SECRET
) {
  return request.post("/api/telegram", {
    headers: { "x-telegram-bot-api-secret-token": secret },
    data: update,
  })
}

function message(text: string) {
  return {
    message: { message_id: 1, chat: { id: CHAT_ID }, text },
  }
}

/** آخر نداء sendMessage وما فيه */
function lastSend() {
  const call = [...calls].reverse().find((c) => c.method === "sendMessage")
  return {
    text: String(call?.body.text ?? ""),
    keyboard: (call?.body.reply_markup as
      | { inline_keyboard: { text: string; callback_data: string }[][] }
      | undefined)?.inline_keyboard,
  }
}

// ------------------------------------------------------------------ الأمان

test.describe("أمان الـ webhook", () => {
  test("يرفض الطلب بلا سرّ صحيح", async ({ request }) => {
    const bad = await send(request, message("ضيف مهمة اختراق"), "wrong-secret")
    expect(bad.status()).toBe(403)

    const none = await request.post("/api/telegram", { data: message("مهمة") })
    expect(none.status()).toBe(403)

    // ولا شيء أُرسل — الرفض قبل أي معالجة
    expect(calls).toHaveLength(0)
  })

  test("يتجاهل محادثة غير مربوطة بلا أي ردّ", async ({ request }) => {
    const response = await send(request, {
      message: { message_id: 1, chat: { id: 123456789 }, text: "ضيف مهمة تسلل" },
    })

    // 200 حتى لا يعيد تيليجرام المحاولة، لكن بلا ردّ على الغريب
    expect(response.status()).toBe(200)
    expect(calls).toHaveLength(0)
  })
})

// ------------------------------------------------------------------ الإضافة

test.describe("إضافة مهمة بالعربية", () => {
  test("جملة كاملة تنتج مهمة بموعدها وأولويتها", async ({ request, page }) => {
    const title = `بوت تسليم التقرير ${Date.now()}`
    const response = await send(request, message(`ضيف مهمة ${title} بكرة عاجل`))
    expect(response.status()).toBe(200)

    const { text, keyboard } = lastSend()
    expect(text).toContain("✅ أضفت")
    expect(text).toContain(title)
    expect(text).toContain("عاجلة")
    // الردّ يعرض الموعد الذي فهمه، فيكشف أي سوء قراءة فوراً
    expect(text).toMatch(/غدًا|غداً|٢|\d/)
    expect(keyboard?.[0][0].text).toBe("⏰ أجّل يوماً")

    // وهي موجودة فعلاً في التطبيق لا في الردّ وحده
    await page.goto("/ar/tasks")
    await expect(page.getByText(title)).toBeVisible()
  })

  test("جملة بلا موعد تُقبل ويُذكر أنها بلا موعد", async ({ request }) => {
    const title = `بوت اتصال ${Date.now()}`
    await send(request, message(title))

    const { text } = lastSend()
    expect(text).toContain(title)
    expect(text).toContain("بلا موعد")
  })

  test("/help يعرض المساعدة ولا ينشئ مهمة", async ({ request }) => {
    await send(request, message("/help"))
    expect(lastSend().text).toContain("أرسل أي جملة لتصير مهمة")
  })
})

// ------------------------------------------------------------------ الأزرار

test.describe("أزرار الإنجاز والتأجيل", () => {
  test("زر ✅ ينجز المهمة ويحرّر الرسالة ويزيل أزرارها", async ({
    request,
    page,
  }) => {
    const title = `بوت إنجاز ${Date.now()}`
    await send(request, message(`${title} اليوم`))

    // نستخرج معرّف المهمة من زر التأجيل في ردّ الإضافة
    const data = lastSend().keyboard?.[0][0].callback_data ?? ""
    const taskId = data.split(":")[1]
    expect(taskId).toBeTruthy()

    calls = []
    await send(request, {
      callback_query: {
        id: "cb-1",
        data: `d:${taskId}`,
        message: {
          message_id: 500,
          chat: { id: CHAT_ID },
          text: `📌 اليوم\n1. ☐ ${title}`,
          reply_markup: {
            inline_keyboard: [
              [
                { text: "✅ 1", callback_data: `d:${taskId}` },
                { text: "⏰ 1", callback_data: `p:${taskId}` },
              ],
            ],
          },
        },
      },
    })

    // يردّ على النقرة، وإلا بقي الزر يبدو معلّقاً
    const answer = calls.find((c) => c.method === "answerCallbackQuery")
    expect(answer?.body.text).toContain("أُنجزت")

    // ويحرّر الرسالة: يشطب السطر ويزيل صف أزرار تلك المهمة
    const edit = calls.find((c) => c.method === "editMessageText")
    expect(String(edit?.body.text)).toContain(`✅ 1. ☐ ${title}`)
    expect(edit?.body.reply_markup).toBeUndefined()

    // والأثر في التطبيق: المهمة صارت منجزة فعلاً لا في ردّ البوت وحده
    await page.goto("/ar/tasks")
    await expect(page.getByRole("checkbox", { name: title })).toBeChecked()
  })

  test("زر ⏰ يؤجّل يوماً", async ({ request }) => {
    const title = `بوت تأجيل ${Date.now()}`
    await send(request, message(`${title} اليوم`))
    const taskId = (lastSend().keyboard?.[0][0].callback_data ?? "").split(":")[1]

    calls = []
    await send(request, {
      callback_query: {
        id: "cb-2",
        data: `p:${taskId}`,
        message: {
          message_id: 501,
          chat: { id: CHAT_ID },
          text: `📌 اليوم\n1. ☐ ${title}`,
        },
      },
    })

    const answer = calls.find((c) => c.method === "answerCallbackQuery")
    expect(answer?.body.text).toContain("أُجّلت")
  })

  test("زر لمهمة غير موجودة لا يكسر شيئاً", async ({ request }) => {
    await send(request, {
      callback_query: {
        id: "cb-3",
        data: "d:clxxxxxxxxxxxxxxxxxxxxxxx",
        message: { message_id: 502, chat: { id: CHAT_ID }, text: "..." },
      },
    })

    const answer = calls.find((c) => c.method === "answerCallbackQuery")
    expect(answer?.body.text).toContain("لم أجد")
    expect(calls.some((c) => c.method === "editMessageText")).toBe(false)
  })
})

// ------------------------------------------------------------------ الملخص

test.describe("الملخص", () => {
  test("/today يعرض المستحق مع أزرار مرقّمة", async ({ request }) => {
    const title = `بوت ملخص ${Date.now()}`
    await send(request, message(`${title} اليوم`))

    calls = []
    await send(request, message("/today"))

    const { text, keyboard } = lastSend()
    expect(text).toContain("📋 ملخص اليوم")
    expect(text).toContain(title)
    // الترقيم يربط السطر بزره — والسطر المرقّم بلا أيقونة ☐ عن قصد
    expect(text).toMatch(/^\d+\. \S/m)
    expect(keyboard?.some((row) => row[0].text.startsWith("✅"))).toBe(true)
  })

  test("الملخص المجدول يحتاج السرّ", async ({ request }) => {
    const bad = await request.get("/api/telegram/digest?key=wrong")
    expect(bad.status()).toBe(403)

    const none = await request.get("/api/telegram/digest")
    expect(none.status()).toBe(403)
  })

  test("الملخص المجدول يعمل بالسرّ الصحيح", async ({ request }) => {
    const title = `بوت صباحي ${Date.now()}`
    await send(request, message(`${title} اليوم`))

    calls = []
    const response = await request.get(
      `/api/telegram/digest?key=${encodeURIComponent(CRON_SECRET)}`
    )
    expect(response.status()).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true, sent: 1 })

    expect(lastSend().text).toContain("صباح الخير")
    expect(lastSend().text).toContain(title)
  })

  test("Authorization: Bearer يعمل كما يرسله Vercel Cron", async ({ request }) => {
    const response = await request.get("/api/telegram/digest", {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    })
    expect(response.status()).toBe(200)
  })
})

// ------------------------------------------------------------------ الجامعة

test.describe("الواجبات والاختبارات", () => {
  test("«ضيف واجب <مادة> <موعد>» ينشئ واجباً مربوطاً بالمادة", async ({
    request,
    page,
  }) => {
    await send(request, message("ضيف واجب الشبكات ينتهي بعد يومين"))

    const { text, keyboard } = lastSend()
    expect(text).toContain("📝")
    expect(text).toContain("📚 الشبكات")
    // الزرّان يحملان بادئة الواجب لا المهمة
    expect(keyboard?.[0][0].callback_data).toMatch(/^ad:/)
    expect(keyboard?.[0][1].callback_data).toMatch(/^ap:/)

    await page.goto("/ar/university?tab=assignments")
    await expect(page.getByText("واجب الشبكات").first()).toBeVisible()
  })

  test("عنوان صريح مع «لمادة» يفصل العنوان عن المادة", async ({ request }) => {
    const title = `بوت تقرير ${Date.now()}`
    await send(request, message(`ضيف واجب ${title} لمادة قواعد البيانات بكرة`))

    const { text } = lastSend()
    expect(text).toContain(`أضفت واجب: ${title}`)
    expect(text).toContain("📚 قواعد البيانات")
  })

  test("مادة مجهولة تعرض المواد المتاحة بدل رفض مبهم", async ({ request }) => {
    await send(request, message("ضيف واجب الكيمياء العضوية بكرة"))

    const { text } = lastSend()
    expect(text).toContain("ما عرفت أي مادة تقصد")
    expect(text).toContain("الشبكات")
  })

  test("واجب بلا موعد يسأل عنه — الموعد إلزامي في المخطط", async ({
    request,
  }) => {
    await send(request, message("ضيف واجب الشبكات"))
    expect(lastSend().text).toContain("متى موعد")
  })

  test("«ضيف اختبار» ينشئ اختباراً لا واجباً", async ({ request }) => {
    await send(request, message("ضيف اختبار أمن المعلومات بعد يومين"))

    const { text, keyboard } = lastSend()
    expect(text).toContain("📕")
    expect(text).toContain("📚 أمن المعلومات")
    // الاختبار لا يُنجَز من إشعار، فلا أزرار له
    expect(keyboard).toBeUndefined()
  })

  test("«ضيف مهمة ... واجب ...» تبقى مهمة", async ({ request }) => {
    const title = `بوت حل واجب ${Date.now()}`
    await send(request, message(`ضيف مهمة ${title} بكرة`))

    // لو انزلقت للمسار الجامعي لطلبت مادة
    expect(lastSend().text).toContain("✅ أضفت")
    expect(lastSend().text).toContain(title)
  })
})

// ------------------------------------------------------------------ الإنجاز

test.describe("الإنجاز بالجملة", () => {
  test("«خلصته» تنهي آخر ما أُضيف بلا سؤال", async ({ request, page }) => {
    const title = `بوت آخر مضاف ${Date.now()}`
    await send(request, message(`${title} بكرة`))

    calls = []
    await send(request, message("خلصته"))

    expect(lastSend().text).toContain("✅ أنجزت")
    expect(lastSend().text).toContain(title)

    await page.goto("/ar/tasks")
    await expect(page.getByRole("checkbox", { name: title })).toBeChecked()
  })

  test("اسم مطابق واحد يُنفَّذ مباشرة", async ({ request }) => {
    const title = `بوت فريد ${Date.now()}`
    await send(request, message(`${title} بكرة`))
    await send(request, message(`مهمة أخرى ${Date.now()} بكرة`))

    calls = []
    await send(request, message(`خلصت ${title}`))
    expect(lastSend().text).toContain(`✅ أنجزت: ${title}`)
  })

  test("تطابق متعدد يسأل بأزرار مرقّمة بدل التخمين", async ({ request }) => {
    const stamp = Date.now()
    await send(request, message(`بوت مكرر ${stamp} أ بكرة`))
    await send(request, message(`بوت مكرر ${stamp} ب بكرة`))

    calls = []
    await send(request, message(`خلصت بوت مكرر ${stamp}`))

    const { text, keyboard } = lastSend()
    expect(text).toContain("أيّها تقصد؟")
    expect(keyboard?.flat()).toHaveLength(2)
    expect(keyboard?.flat()[0].text).toBe("✅ 1")
  })

  test("اسم غير موجود يردّ بوضوح ولا ينشئ شيئاً", async ({ request }) => {
    await send(request, message("خلصت شيء غير موجود أبداً"))
    expect(lastSend().text).toContain("ما لقيت")
  })

  test("«خلصت» على واجب تُنهي الواجب لا مهمة", async ({ request, page }) => {
    const title = `بوت واجب منجز ${Date.now()}`
    await send(request, message(`ضيف واجب ${title} لمادة الشبكات بكرة`))

    calls = []
    await send(request, message(`خلصت ${title}`))
    expect(lastSend().text).toContain("✅ أنجزت")

    await page.goto("/ar/university?tab=assignments")
    await expect(page.getByText(title)).toBeVisible()
  })
})

// ------------------------------------------------------------------ الأرشيف

test.describe("أرشفة الملفات من البوت", () => {
  /** مستند كما يرسله تيليجرام */
  function document(name: string, extra: Record<string, unknown> = {}) {
    return {
      message: {
        message_id: 1,
        chat: { id: CHAT_ID },
        document: {
          file_id: "FILE-1",
          file_name: name,
          mime_type: "application/pdf",
          file_size: BOT_PDF.length,
          ...extra,
        },
      },
    }
  }

  test("ملف مرسَل يُؤرشف ويُعرض عليه ربطه بمادة", async ({ request, page }) => {
    const name = `أرشيف بوت ${Date.now()}.pdf`
    await send(request, document(name))

    const { text, keyboard } = lastSend()
    expect(text).toContain("📎 أُرشف")
    expect(text).toContain(name.replace(".pdf", ""))
    expect(text).toContain("اربطه بمادة؟")
    // زر لكل مادة في الفصل النشط
    expect(keyboard?.flat().some((b) => b.text === "الشبكات")).toBe(true)

    // والملف وصل الأرشيف فعلاً بمحتواه
    await page.goto("/ar/archive")
    const card = page.locator("li").filter({ hasText: name.replace(".pdf", "") })
    await expect(card).toBeVisible()

    const href = await card.getByRole("link").first().getAttribute("href")
    const file = await page.request.get(href!)
    expect((await file.body()).toString()).toContain("ملف من البوت")
  })

  test("التعليق المرفق يصير عنواناً", async ({ request }) => {
    const caption = `عنوان من التعليق ${Date.now()}`
    await send(request, {
      message: {
        message_id: 1,
        chat: { id: CHAT_ID },
        caption,
        document: {
          file_id: "FILE-2",
          file_name: "ignored.pdf",
          mime_type: "application/pdf",
          file_size: BOT_PDF.length,
        },
      },
    })

    expect(lastSend().text).toContain(caption)
  })

  test("زر المادة يربط الملف ويحدّث الرسالة", async ({ request, page }) => {
    const name = `أرشيف ربط ${Date.now()}.pdf`
    await send(request, document(name))

    const button = lastSend().keyboard?.flat().find((b) => b.text === "الشبكات")
    expect(button?.callback_data).toMatch(/^as:/)

    calls = []
    await send(request, {
      callback_query: {
        id: "cb-archive",
        data: button!.callback_data,
        message: { message_id: 900, chat: { id: CHAT_ID }, text: "📎 أُرشف: x" },
      },
    })

    const answer = calls.find((c) => c.method === "answerCallbackQuery")
    expect(String(answer?.body.text)).toContain("الشبكات")

    const edit = calls.find((c) => c.method === "editMessageText")
    expect(String(edit?.body.text)).toContain("📚 الشبكات")

    await page.goto("/ar/archive")
    await expect(
      page.locator("li").filter({ hasText: name.replace(".pdf", "") })
    ).toContainText("الشبكات")
  })

  test("ملف فوق حدّ تيليجرام يُرفض برسالة مفهومة", async ({ request }) => {
    await send(
      request,
      document("ضخم.pdf", { file_size: 25 * 1024 * 1024 })
    )

    const { text } = lastSend()
    expect(text).toContain("أكبر من")
    // يقترح البديل بدل أن يقف عند الرفض
    expect(text).toContain("من الموقع")
  })
})
