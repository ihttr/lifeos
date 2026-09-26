import { isTelegramConfigured } from "@/lib/telegram"
import { sendMorningDigests } from "@/server/telegram/handle"

/**
 * الملخص الصباحي — يستدعيه مجدول خارجي.
 *
 * يقبل السرّ بطريقتين لأن المجدول قد يتغير:
 *   • `Authorization: Bearer <CRON_SECRET>` — ما يرسله Vercel Cron تلقائياً
 *   • `?key=<CRON_SECRET>` — لأي مجدول آخر (GitHub Actions مثلاً)
 *
 * والثانية موجودة عن قصد: حدود Vercel Cron على الخطة المجانية ضيّقة،
 * فيجب أن يبقى المسار قابلاً للنداء من الخارج بلا تعديل كود.
 */

export const dynamic = "force-dynamic"

/** يمنع تسريب الفرق الزمني بين سرّ صحيح وخاطئ */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET

  if (!secret) {
    console.error("telegram: CRON_SECRET غير معرّف — الملخص معطّل")
    return new Response("forbidden", { status: 403 })
  }

  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  const query = new URL(request.url).searchParams.get("key")
  const provided = bearer ?? query ?? ""

  if (!safeEqual(provided, secret)) {
    return new Response("forbidden", { status: 403 })
  }

  if (!isTelegramConfigured()) {
    return Response.json({ ok: false, reason: "telegram not configured" })
  }

  const result = await sendMorningDigests()
  return Response.json({ ok: true, ...result })
}
