/**
 * أداة إعداد البوت. ثلاثة أوامر:
 *
 *   node scripts/telegram.mjs whoami   يطبع معرّف محادثتك
 *   node scripts/telegram.mjs setup    يربط الـ webhook بالرابط المنشور
 *   node scripts/telegram.mjs status   يعرض حالة الـ webhook الحالية
 *
 * تقرأ الأسرار من البيئة ولا تطبعها. ما يُطبع هو معرّف المحادثة فقط،
 * وهو رقم غير سرّي بحد ذاته — الحماية في التوكن والسرّ لا فيه.
 */

import "dotenv/config"

const token = process.env.TELEGRAM_BOT_TOKEN
const secret = process.env.TELEGRAM_WEBHOOK_SECRET
const command = process.argv[2] ?? "status"

if (!token) {
  console.error("✗ TELEGRAM_BOT_TOKEN غير مضبوط. خذه من @BotFather وضعه في .env")
  process.exit(1)
}

async function api(method, body) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  })

  const json = await response.json()
  if (!json.ok) {
    console.error(`✗ ${method}: ${json.description}`)
    process.exit(1)
  }
  return json.result
}

if (command === "whoami") {
  // getUpdates لا يعمل والـ webhook مربوط — نفصله مؤقتاً ثم نعيده
  const hook = await api("getWebhookInfo")
  if (hook.url) {
    console.log("↷ أفصل الـ webhook مؤقتاً لقراءة الرسائل...")
    await api("deleteWebhook")
  }

  const updates = await api("getUpdates", { limit: 10 })
  const chats = new Map()
  for (const update of updates) {
    const chat = update.message?.chat ?? update.callback_query?.message?.chat
    if (chat) chats.set(chat.id, chat.first_name ?? chat.title ?? "")
  }

  if (chats.size === 0) {
    console.log("")
    console.log("لم أجد رسائل. راسل البوت بأي كلمة ثم أعد هذا الأمر.")
  } else {
    console.log("")
    for (const [id, name] of chats) {
      console.log(`  TELEGRAM_CHAT_ID=${id}${name ? `   (${name})` : ""}`)
    }
    console.log("")
    console.log("ضع السطر في .env وفي متغيّرات Vercel، ثم شغّل: npm run telegram:setup")
  }

  if (hook.url) {
    await api("setWebhook", {
      url: hook.url,
      secret_token: secret,
      allowed_updates: ["message", "callback_query"],
    })
    console.log("✓ أُعيد ربط الـ webhook")
  }
  process.exit(0)
}

if (command === "setup") {
  const base = (process.env.TELEGRAM_WEBHOOK_URL ?? process.env.AUTH_URL ?? "")
    .trim()
    .replace(/\/$/, "")

  if (!secret) {
    console.error("✗ TELEGRAM_WEBHOOK_SECRET غير مضبوط — بدونه الـ webhook مفتوح للجميع")
    process.exit(1)
  }

  if (!base.startsWith("https://")) {
    console.error("✗ تيليجرام يقبل https فقط.")
    console.error("  اضبط TELEGRAM_WEBHOOK_URL على رابط الإنتاج، مثل:")
    console.error("  TELEGRAM_WEBHOOK_URL=https://lifeos.vercel.app")
    process.exit(1)
  }

  await api("setWebhook", {
    url: `${base}/api/telegram`,
    secret_token: secret,
    // نطلب النوعين اللذين نعالجهما فقط — أقل ضجيجاً وأقل استدعاءات
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  })

  await api("setMyCommands", {
    commands: [
      { command: "today", description: "ملخص اليوم" },
      { command: "help", description: "المساعدة" },
    ],
  })

  console.log(`✓ رُبط الـ webhook بـ ${base}/api/telegram`)
  console.log("✓ سُجّلت الأوامر")
  console.log("")
  console.log("جرّب: أرسل للبوت «ضيف مهمة تجربة بكرة»")
  process.exit(0)
}

if (command === "status") {
  const info = await api("getWebhookInfo")
  const me = await api("getMe")

  console.log(`البوت:    @${me.username}`)
  console.log(`الرابط:   ${info.url || "— غير مربوط"}`)
  console.log(`السرّ:    ${info.has_custom_certificate ? "شهادة" : secret ? "مضبوط" : "✗ غائب"}`)
  console.log(`معلّق:    ${info.pending_update_count} تحديث`)
  if (info.last_error_message) {
    console.log(`آخر خطأ: ${info.last_error_message}`)
  }
  process.exit(0)
}

console.error(`✗ أمر غير معروف: ${command}`)
console.error("  المتاح: whoami | setup | status")
process.exit(1)
