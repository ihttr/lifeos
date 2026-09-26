import "server-only"

import { db } from "@/lib/db"
import { formatDateShort, relativeDueLabel, todayISO } from "@/lib/dates"
import { answerCallback, editMessage, sendMessage } from "@/lib/telegram"
import { parseTaskMessage } from "@/lib/telegram-parse"
import { createTaskSchema } from "@/schemas/task"
import {
  createTaskFor,
  postponeTaskFor,
  setTaskDoneFor,
} from "@/server/core/tasks"
import { buildDigest, markSoonSent } from "@/server/telegram/digest"

import type {
  InlineButton,
  InlineKeyboardMarkup,
  TelegramUpdate,
} from "@/lib/telegram"

/**
 * منطق البوت.
 *
 * كل دالة تنتهي برسالة للمستخدم: لا فشل صامت. وما لا نفهمه يصير مهمة
 * بدل أن نردّ بخطأ — البوت صندوق وارد قبل أن يكون واجهة أوامر.
 */

const HELP = [
  "🤖 LifeOS",
  "",
  "أرسل أي جملة لتصير مهمة:",
  "• ضيف مهمة حل الواجب بكرة",
  "• مراجعة الفصل الثالث الخميس",
  "• تسليم التقرير بعد أسبوع عاجل",
  "",
  "الأوامر:",
  "/today — ملخص اليوم",
  "/help — هذه الرسالة",
].join("\n")

/** يعرّف المحادثة على مستخدم. عدم وجود ارتباط = تجاهل تام. */
export async function resolveUser(chatId: string) {
  return db.user.findUnique({
    where: { telegramChatId: chatId },
    select: { id: true, name: true },
  })
}

// ------------------------------------------------------------------ الرسائل

async function handleToday(userId: string, chatId: string) {
  const digest = await buildDigest(userId, {
    greeting: "📋 ملخص اليوم",
    includeSoon: true,
    // الطلب اليدوي يعرض كل شيء — لا إخفاء بحجة أنه أُرسل صباحاً
    skipSentSoon: false,
  })

  if (!digest) {
    await sendMessage({ chatId, text: "✨ لا شيء مستحق. يومك صافٍ." })
    return
  }

  await sendMessage({ chatId, text: digest.text, buttons: digest.buttons })
}

async function handleAddTask(userId: string, chatId: string, text: string) {
  const parsed = parseTaskMessage(text)

  // نمرّره على نفس مخطط Zod الذي تستخدمه الواجهة — لا مسار كتابة موازي
  const input = createTaskSchema.safeParse({
    title: parsed.title,
    dueDate: parsed.dueDate ?? undefined,
    priority: parsed.priority,
    tags: [],
  })

  if (!input.success) {
    await sendMessage({
      chatId,
      text: "⚠️ لم أفهم عنوان المهمة. أرسل مثلاً: ضيف مهمة حل الواجب بكرة",
    })
    return
  }

  const task = await createTaskFor(userId, input.data)

  const details: string[] = []
  if (parsed.dueDate) {
    const relative = relativeDueLabel(parsed.dueDate, "ar")
    details.push(`📅 ${formatDateShort(parsed.dueDate, "ar")} (${relative})`)
  }
  if (parsed.priority !== "MEDIUM") {
    const labels = { URGENT: "عاجلة", HIGH: "أولوية عالية", LOW: "أولوية منخفضة" }
    details.push(`🔺 ${labels[parsed.priority as keyof typeof labels]}`)
  }
  if (!parsed.dueDate) details.push("📅 بلا موعد")

  await sendMessage({
    chatId,
    text: [`✅ أضفت: ${parsed.title}`, ...details].join("\n"),
    buttons: [[{ text: "⏰ أجّل يوماً", data: `p:${task.id}` }]],
  })
}

export async function handleMessage(
  userId: string,
  chatId: string,
  text: string
) {
  const trimmed = text.trim()
  const command = trimmed.split(/\s+/)[0].toLowerCase().replace(/@\S+$/, "")

  if (command === "/start" || command === "/help") {
    await sendMessage({ chatId, text: HELP })
    return
  }

  if (command === "/today" || trimmed === "اليوم" || trimmed === "يومي") {
    await handleToday(userId, chatId)
    return
  }

  // /task مجرّد بادئة — المحلّل يتعامل مع الجملة كما هي
  const body = command === "/task" ? trimmed.slice(command.length).trim() : trimmed

  if (!body) {
    await sendMessage({ chatId, text: HELP })
    return
  }

  await handleAddTask(userId, chatId, body)
}

// ------------------------------------------------------------------ الأزرار

/**
 * يزيل صف أزرار المهمة التي عُولجت، ويبقي الباقي.
 *
 * تيليجرام يرسل لوحة الأزرار الحالية مع كل نقرة، فنبني الجديدة منها
 * بدل حفظ حالة في قاعدة البيانات.
 */
function keyboardWithout(
  markup: InlineKeyboardMarkup | undefined,
  taskId: string
): InlineButton[][] | undefined {
  const rows = markup?.inline_keyboard
  if (!rows) return undefined

  const kept = rows
    .map((row) =>
      row
        .filter((button) => !button.callback_data?.endsWith(`:${taskId}`))
        .map((button) => ({ text: button.text, data: button.callback_data ?? "" }))
    )
    .filter((row) => row.length > 0)

  return kept.length ? kept : undefined
}

/** يشطب سطر المهمة في نص الملخص بعلامة، فيبقى السياق مرئياً */
function markLine(text: string, title: string, mark: string): string {
  return text
    .split("\n")
    .map((row) => (row.includes(title) && !row.startsWith(mark) ? `${mark} ${row}` : row))
    .join("\n")
}

export async function handleCallback(
  userId: string,
  callback: NonNullable<TelegramUpdate["callback_query"]>
) {
  const data = callback.data ?? ""
  const [action, taskId] = data.split(":")
  const message = callback.message

  if (!taskId || !message) {
    await answerCallback(callback.id)
    return
  }

  const chatId = String(message.chat.id)

  const task = await db.task.findFirst({
    where: { id: taskId, userId },
    select: { title: true },
  })

  if (!task) {
    await answerCallback(callback.id, "لم أجد هذه المهمة")
    return
  }

  try {
    if (action === "d") {
      const { spawned } = await setTaskDoneFor(userId, taskId, true)
      await answerCallback(
        callback.id,
        spawned ? "✓ أُنجزت، وأُنشئت النسخة التالية" : "✓ أُنجزت"
      )

      if (message.text) {
        await editMessage({
          chatId,
          messageId: message.message_id,
          text: markLine(message.text, task.title, "✅"),
          buttons: keyboardWithout(message.reply_markup, taskId),
        })
      }
      return
    }

    if (action === "p") {
      const { dueDate } = await postponeTaskFor(userId, taskId, 1)
      const label = dueDate === todayISO() ? "اليوم" : formatDateShort(dueDate, "ar")
      await answerCallback(callback.id, `⏰ أُجّلت إلى ${label}`)

      if (message.text) {
        await editMessage({
          chatId,
          messageId: message.message_id,
          text: markLine(message.text, task.title, "⏰"),
          buttons: keyboardWithout(message.reply_markup, taskId),
        })
      }
      return
    }

    await answerCallback(callback.id)
  } catch (error) {
    console.error("telegram: فشل تنفيذ الزر", error)
    await answerCallback(callback.id, "تعذّر التنفيذ")
  }
}

// ------------------------------------------------------------------ المجدولة

/** الملخص الصباحي لكل مستخدم مرتبط — يستدعيه cron */
export async function sendMorningDigests(): Promise<{
  sent: number
  skipped: number
}> {
  const users = await db.user.findMany({
    where: { telegramChatId: { not: null } },
    select: { id: true, name: true, telegramChatId: true },
  })

  let sent = 0
  let skipped = 0

  for (const user of users) {
    const chatId = user.telegramChatId
    if (!chatId) continue

    const digest = await buildDigest(user.id, {
      greeting: user.name ? `🌅 صباح الخير ${user.name}` : "🌅 صباح الخير",
      includeSoon: true,
      skipSentSoon: true,
    })

    // لا شيء مستحق ⇒ لا رسالة. البوت الذي يرسل «لا جديد» كل صباح يُكتم.
    if (!digest) {
      skipped += 1
      continue
    }

    const ok = await sendMessage({
      chatId,
      text: digest.text,
      buttons: digest.buttons,
    })

    // نسجّل القادم بعد نجاح الإرسال فقط، وإلا خسرناه بلا إشعار
    if (ok) {
      await markSoonSent(user.id, digest.soonKeys)
      sent += 1
    } else {
      skipped += 1
    }
  }

  return { sent, skipped }
}
