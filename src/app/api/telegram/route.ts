import { isTelegramConfigured } from "@/lib/telegram"
import {
  handleCallback,
  handleMessage,
  resolveUser,
} from "@/server/telegram/handle"

import type { TelegramUpdate } from "@/lib/telegram"

/**
 * webhook تيليجرام.
 *
 * مسار دخول ثانٍ للكتابة، فالأمان هنا كله صريح:
 *
 *  1. سرّ في ترويسة `X-Telegram-Bot-Api-Secret-Token` — يثبت أن الطلب من
 *     تيليجرام لا من أي أحد يعرف الرابط.
 *  2. المحادثة يجب أن تكون مربوطة بمستخدم في القاعدة. بوتات تيليجرام
 *     قابلة للاكتشاف، فبدون هذا القيد يكتب أي غريب في قاعدتك.
 *
 * وبعد اجتياز الفحصين نرجع 200 دائماً: تيليجرام يعيد المحاولة على أي
 * رمز خطأ، فخطأ برمجي واحد يتحول إلى عاصفة طلبات. الأخطاء تُسجّل
 * وتُبلَّغ للمستخدم كرسالة، لا كرمز HTTP.
 */

// مسار محمي بسرّ ويكتب في القاعدة — لا تخزين مؤقت بحال
export const dynamic = "force-dynamic"

function unauthorized() {
  return new Response("forbidden", { status: 403 })
}

export async function POST(request: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET

  if (!isTelegramConfigured() || !secret) {
    console.error("telegram: webhook مُستدعى وإعدادات البوت ناقصة")
    return unauthorized()
  }

  if (request.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return unauthorized()
  }

  let update: TelegramUpdate
  try {
    update = (await request.json()) as TelegramUpdate
  } catch {
    return new Response("bad request", { status: 400 })
  }

  try {
    const chatId = String(
      update.message?.chat.id ?? update.callback_query?.message?.chat.id ?? ""
    )

    if (!chatId) return Response.json({ ok: true })

    const user = await resolveUser(chatId)

    // محادثة غير مربوطة: تجاهل صامت. لا نؤكد للغريب أن البوت حقيقي،
    // ولا نطبع معرّفه في الردّ.
    if (!user) {
      console.warn(`telegram: محادثة غير مربوطة ${chatId}`)
      return Response.json({ ok: true })
    }

    if (update.callback_query) {
      await handleCallback(user.id, update.callback_query)
    } else if (update.message?.text) {
      await handleMessage(user.id, chatId, update.message.text)
    }
  } catch (error) {
    console.error("telegram: خطأ غير متوقع في webhook", error)
  }

  return Response.json({ ok: true })
}
