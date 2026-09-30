import "server-only"

/**
 * عميل رقيق لواجهة Telegram Bot API.
 *
 * لا مكتبة خارجية: نحتاج أربع دوال فقط، والمكتبات الجاهزة تفترض
 * عملية طويلة الأمد مع long polling — وهذا لا يناسب دوال Vercel.
 *
 * كل دالة تُرجع نجاحاً أو فشلاً بدل أن ترمي، لأن الملخص الصباحي
 * لا يجب أن يسقط كاملاً بسبب رسالة واحدة فشلت.
 */

/**
 * قابل للتوجيه لأجل الاختبار فقط: اختبار e2e يشغّل خادماً وهمياً محلياً
 * ويؤكّد ما كان البوت سيرسله فعلاً. في الإنتاج يبقى على القيمة الافتراضية.
 */
const API = process.env.TELEGRAM_API_BASE ?? "https://api.telegram.org"

/** حدّ تيليجرام لطول callback_data — نتحقق منه قبل الإرسال لا بعده */
const CALLBACK_DATA_MAX_BYTES = 64

export type InlineButton = {
  text: string
  /** لا يزيد عن 64 بايت بعد ترميز UTF-8 */
  data: string
}

export function isTelegramConfigured(): boolean {
  return Boolean(
    process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_WEBHOOK_SECRET
  )
}

/** يهرّب النص ليُرسل بـ parse_mode: HTML */
export function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

async function call(
  method: string,
  body: Record<string, unknown>
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    console.error("telegram: TELEGRAM_BOT_TOKEN غير معرّف")
    return false
  }

  try {
    const response = await fetch(`${API}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      // لا نريد لدالة serverless أن تتعلّق على شبكة بطيئة
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) {
      // نص الخطأ من تيليجرام مفيد جداً في التشخيص (chat not found، إلخ)
      console.error(`telegram: ${method} → ${response.status}`, await response.text())
      return false
    }

    return true
  } catch (error) {
    console.error(`telegram: ${method} فشل`, error)
    return false
  }
}

function keyboard(buttons: InlineButton[][] | undefined) {
  if (!buttons?.length) return undefined

  const rows = buttons.map((row) =>
    row
      .filter((button) => {
        const size = new TextEncoder().encode(button.data).length
        if (size > CALLBACK_DATA_MAX_BYTES) {
          console.error(`telegram: callback_data طويل (${size}B)`, button.data)
          return false
        }
        return true
      })
      .map((button) => ({ text: button.text, callback_data: button.data }))
  )

  const kept = rows.filter((row) => row.length > 0)
  return kept.length ? { inline_keyboard: kept } : undefined
}

export function sendMessage({
  chatId,
  text,
  buttons,
}: {
  chatId: string
  text: string
  buttons?: InlineButton[][]
}): Promise<boolean> {
  return call("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    // معاينات الروابط تضاعف طول الرسالة بلا فائدة هنا
    link_preview_options: { is_disabled: true },
    reply_markup: keyboard(buttons),
  })
}

export function editMessage({
  chatId,
  messageId,
  text,
  buttons,
}: {
  chatId: string
  messageId: number
  text: string
  buttons?: InlineButton[][]
}): Promise<boolean> {
  return call("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    reply_markup: keyboard(buttons),
  })
}

/**
 * حدّ تنزيل البوت: 20 ميبي بايت بالضبط، لا يتجاوزه الـ API العام.
 * نفحصه قبل النداء لنعطي رسالة مفهومة بدل خطأ غامض من تيليجرام.
 */
export const TELEGRAM_MAX_DOWNLOAD = 20 * 1024 * 1024

/**
 * ينزّل ملفاً وصل للبوت.
 *
 * نداءان: getFile يعطي مساراً مؤقتاً، ثم نحمّل من نطاق الملفات لا من
 * نطاق الـ API. يعيد null عند أي فشل — المستدعي يخبر المستخدم.
 */
export async function downloadFile(
  fileId: string
): Promise<{ body: Buffer; path: string } | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return null

  try {
    const info = await fetch(`${API}/bot${token}/getFile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_id: fileId }),
      signal: AbortSignal.timeout(15_000),
    })

    if (!info.ok) {
      console.error("telegram: getFile فشل", await info.text())
      return null
    }

    const json = (await info.json()) as {
      ok: boolean
      result?: { file_path?: string }
    }

    const path = json.result?.file_path
    if (!path) return null

    // نطاق الملفات يختلف عن نطاق الـ API — /file/bot<token>/<path>
    const base = API.replace(/\/$/, "")
    const download = await fetch(`${base}/file/bot${token}/${path}`, {
      signal: AbortSignal.timeout(60_000),
    })

    if (!download.ok) {
      console.error("telegram: تنزيل الملف فشل", download.status)
      return null
    }

    return { body: Buffer.from(await download.arrayBuffer()), path }
  } catch (error) {
    console.error("telegram: تنزيل الملف فشل", error)
    return null
  }
}

/**
 * تيليجرام يُظهر دائرة تحميل على الزر حتى يوصل هذا الرد.
 * إغفاله يجعل الزر يبدو معلّقاً، فنستدعيه دائماً ولو بلا نص.
 */
export function answerCallback(
  callbackQueryId: string,
  text?: string
): Promise<boolean> {
  return call("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    ...(text ? { text } : {}),
  })
}

// ------------------------------------------------------------------ التحديثات

/** لوحة الأزرار كما يعيدها تيليجرام مع كل نقرة */
export type InlineKeyboardMarkup = {
  inline_keyboard: { text: string; callback_data?: string }[][]
}

/** ملف مرفق — مستند أو صورة أو صوت، كلها بنفس الشكل تقريباً */
export type TelegramDocument = {
  file_id: string
  file_name?: string
  mime_type?: string
  file_size?: number
}

export type TelegramMessage = {
  message_id: number
  chat: { id: number }
  text?: string
  /** التعليق المرفق بالملف — نستخدمه عنواناً */
  caption?: string
  document?: TelegramDocument
  /** الصور تصل بمقاسات متعددة، آخرها الأكبر */
  photo?: TelegramDocument[]
  reply_markup?: InlineKeyboardMarkup
}

export type TelegramUpdate = {
  message?: TelegramMessage
  callback_query?: {
    id: string
    data?: string
    message?: TelegramMessage
  }
}
