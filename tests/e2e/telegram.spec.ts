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
    const chunks: Buffer[] = []
    request.on("data", (chunk: Buffer) => chunks.push(chunk))
    request.on("end", () => {
      const method = (request.url ?? "").split("/").pop() ?? ""
      const body = JSON.parse(Buffer.concat(chunks).toString() || "{}")
      calls.push({ method, body })

      response.writeHead(200, { "Content-Type": "application/json" })
      response.end(
        JSON.stringify({
          ok: true,
          result: { message_id: nextMessageId++, date: 0, chat: { id: CHAT_ID } },
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
