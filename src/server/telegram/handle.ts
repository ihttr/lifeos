import "server-only"

import { db } from "@/lib/db"
import { formatDateShort, relativeDueLabel, todayISO } from "@/lib/dates"
import {
  answerCallback,
  downloadFile,
  editMessage,
  sendMessage,
  TELEGRAM_MAX_DOWNLOAD,
} from "@/lib/telegram"
import {
  matchSubject,
  parseMessage,
  parseTaskMessage,
} from "@/lib/telegram-parse"
import { createTaskSchema } from "@/schemas/task"
import { createAssignmentSchema, createExamSchema } from "@/schemas/university"
import { linkArchiveSubject, uploadArchiveFile } from "@/server/core/archive"
import {
  createTaskFor,
  postponeTaskFor,
  setTaskDoneFor,
} from "@/server/core/tasks"
import {
  createAssignmentFor,
  createExamFor,
  getActiveSubjects,
  postponeAssignmentFor,
  setAssignmentStatusFor,
} from "@/server/core/university"
import { findOpenItems } from "@/server/telegram/complete"
import { buildDigest, markSoonSent } from "@/server/telegram/digest"

import type {
  InlineButton,
  InlineKeyboardMarkup,
  TelegramUpdate,
} from "@/lib/telegram"
import type { ParsedMessage } from "@/lib/telegram-parse"

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
  if (parsed.dueDate) details.push(dueLine(parsed.dueDate))
  if (parsed.priority !== "MEDIUM") {
    const labels = {
      URGENT: "عاجلة",
      HIGH: "أولوية عالية",
      LOW: "أولوية منخفضة",
    }
    details.push(`🔺 ${labels[parsed.priority as keyof typeof labels]}`)
  }
  if (!parsed.dueDate) details.push("📅 بلا موعد")

  await sendMessage({
    chatId,
    text: [`✅ أضفت: ${parsed.title}`, ...details].join("\n"),
    buttons: [[{ text: "⏰ أجّل يوماً", data: `p:${task.id}` }]],
  })
}

// ------------------------------------------------------------------ الجامعة

/**
 * سطر الموعد. relativeDueLabel يعود إلى التاريخ المختصر بعد ستة أيام،
 * فلولا هذا الفحص لطُبع «4 أكتوبر (4 أكتوبر)».
 */
function dueLine(iso: string): string {
  const short = formatDateShort(iso, "ar")
  const relative = relativeDueLabel(iso, "ar")
  return relative === short ? `📅 ${short}` : `📅 ${short} (${relative})`
}

/** يعرض المواد المتاحة حين تفشل المطابقة — أنفع من «لم أفهم» */
async function replyNoSubject(
  chatId: string,
  subjects: { name: string }[],
  what: string
) {
  if (!subjects.length) {
    await sendMessage({
      chatId,
      text: `⚠️ لا مواد في فصلك النشط، ولا يمكن إضافة ${what} بلا مادة.\nأضف موادك من قسم الجامعة أولاً.`,
    })
    return
  }

  await sendMessage({
    chatId,
    text: [
      `⚠️ ما عرفت أي مادة تقصد. موادك الحالية:`,
      ...subjects.map((s) => `• ${s.name}`),
      "",
      `مثال: ضيف ${what} ${subjects[0].name} السبت`,
    ].join("\n"),
  })
}

async function handleUniversity(
  userId: string,
  chatId: string,
  parsed: Extract<ParsedMessage, { kind: "assignment" | "exam" }>
) {
  const isExam = parsed.kind === "exam"
  const what = isExam ? "اختبار" : "واجب"

  const subjects = await getActiveSubjects(userId)
  const match = matchSubject(parsed.rest, subjects)

  if (!match) {
    await replyNoSubject(chatId, subjects, what)
    return
  }

  // الموعد إلزامي للاثنين في المخطط، فلا نخمّنه — نسأل عنه
  if (!parsed.dueDate) {
    await sendMessage({
      chatId,
      text: `⚠️ متى موعد ${what} ${match.subject.name}؟\nمثال: ضيف ${what} ${match.subject.name} السبت`,
    })
    return
  }

  // بلا عنوان صريح يصير العنوان «واجب الشبكات» — مفهوم بذاته في التطبيق
  const explicit = match.rest
  const title = explicit || `${what} ${match.subject.name}`

  // ولا نكرّر الكلمة في الردّ: «أضفت واجب الشبكات» لا «أضفت واجب: واجب الشبكات»
  const headline = explicit ? `أضفت ${what}: ${title}` : `أضفت ${title}`

  const input = isExam
    ? createExamSchema.safeParse({
        subjectId: match.subject.id,
        title,
        date: parsed.dueDate,
      })
    : createAssignmentSchema.safeParse({
        subjectId: match.subject.id,
        title,
        dueDate: parsed.dueDate,
      })

  if (!input.success) {
    await sendMessage({
      chatId,
      text: `⚠️ تعذّر إنشاء ${what}. جرّب صياغة أوضح.`,
    })
    return
  }

  const when = dueLine(parsed.dueDate)

  if (isExam) {
    await createExamFor(
      userId,
      input.data as { subjectId: string; title: string; date: string }
    )
    await sendMessage({
      chatId,
      text: [`📕 ${headline}`, `📚 ${match.subject.name}`, when].join("\n"),
    })
    return
  }

  const assignment = await createAssignmentFor(
    userId,
    input.data as { subjectId: string; title: string; dueDate: string }
  )

  await sendMessage({
    chatId,
    text: [`📝 ${headline}`, `📚 ${match.subject.name}`, when].join("\n"),
    buttons: [
      [
        { text: "✅ أنجزته", data: `ad:${assignment.id}` },
        { text: "⏰ أجّل يوماً", data: `ap:${assignment.id}` },
      ],
    ],
  })
}

// ------------------------------------------------------------------ الأرشيف

/**
 * ملف وصل للبوت.
 *
 * يُؤرشَف فوراً بلا سؤال، ثم تُعرض أزرار المواد لربطه. السبب أن الرفع
 * هو الجزء الثمين والهشّ — لو سألنا أولاً لضاع الملف إن انشغل المستخدم
 * أو أغلق التطبيق. الربط تفصيلٌ يُستدرك، والملف لا يُستدرك.
 */
export async function handleDocument(
  userId: string,
  chatId: string,
  message: NonNullable<TelegramUpdate["message"]>
) {
  // الصور تصل بمقاسات متعددة — الأخير أكبرها
  const doc = message.document ?? message.photo?.at(-1)
  if (!doc) return

  if ((doc.file_size ?? 0) > TELEGRAM_MAX_DOWNLOAD) {
    const mb = Math.floor(TELEGRAM_MAX_DOWNLOAD / 1024 / 1024)
    await sendMessage({
      chatId,
      text: `⚠️ الملف أكبر من ${mb} ميجا، وهو حدّ تيليجرام للبوتات.\nارفعه من الموقع بدلاً من ذلك.`,
    })
    return
  }

  const downloaded = await downloadFile(doc.file_id)
  if (!downloaded) {
    await sendMessage({ chatId, text: "⚠️ تعذّر تنزيل الملف. جرّب مرة أخرى." })
    return
  }

  // اسم الصور لا يصل من تيليجرام، فنشتقّه من مسار الملف المؤقت
  const filename = doc.file_name ?? downloaded.path.split("/").pop() ?? "file"
  const title = message.caption?.trim() || filename.replace(/\.[^.]+$/, "")

  try {
    const created = await uploadArchiveFile(userId, {
      filename,
      body: downloaded.body,
      contentType: doc.mime_type ?? "application/octet-stream",
      source: "TELEGRAM",
      meta: { title, kind: "OTHER" },
    })

    const subjects = await getActiveSubjects(userId)

    await sendMessage({
      chatId,
      text: [`📎 أُرشف: ${title}`, subjects.length ? "اربطه بمادة؟" : ""]
        .filter(Boolean)
        .join("\n"),
      buttons: subjects.length
        ? chunk(
            subjects.map((subject) => ({
              text: subject.name,
              data: `as:${created.id}:${subject.id}`,
            })),
            2
          )
        : undefined,
    })
  } catch (error) {
    console.error("telegram: فشل أرشفة الملف", error)
    await sendMessage({ chatId, text: "⚠️ تعذّرت الأرشفة." })
  }
}

// ------------------------------------------------------------------ الإنجاز

async function handleDone(userId: string, chatId: string, query: string) {
  const items = await findOpenItems(userId, query)

  if (!items.length) {
    await sendMessage({
      chatId,
      text: query
        ? `🤔 ما لقيت شيئاً مفتوحاً باسم «${query}».`
        : "🤔 ما عندك شيء مفتوح.",
    })
    return
  }

  // نتيجة واحدة = نيّة واضحة، فننفّذ بلا سؤال
  if (items.length === 1) {
    const item = items[0]
    if (item.kind === "task") await setTaskDoneFor(userId, item.id, true)
    else await setAssignmentStatusFor(userId, item.id, "DONE")

    await sendMessage({
      chatId,
      text: `✅ أنجزت: ${item.title}${item.context ? ` — ${item.context}` : ""}`,
    })
    return
  }

  // أكثر من نتيجة: نسأل بدل أن نخمّن — إنجاز الخطأ يحتاج تراجعاً يدوياً
  await sendMessage({
    chatId,
    text: [
      "🤔 أيّها تقصد؟",
      ...items.map(
        (item, i) =>
          `${i + 1}. ${item.title}${item.context ? ` — ${item.context}` : ""}`
      ),
    ].join("\n"),
    buttons: chunk(
      items.map((item, i) => ({
        text: `✅ ${i + 1}`,
        data: `${item.kind === "task" ? "d" : "ad"}:${item.id}`,
      })),
      3
    ),
  })
}

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = []
  for (let i = 0; i < items.length; i += size)
    rows.push(items.slice(i, i + size))
  return rows
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
  const body =
    command === "/task" ? trimmed.slice(command.length).trim() : trimmed

  if (!body) {
    await sendMessage({ chatId, text: HELP })
    return
  }

  const parsed = parseMessage(body)

  if (parsed.kind === "done") {
    await handleDone(userId, chatId, parsed.query)
    return
  }

  if (parsed.kind === "assignment" || parsed.kind === "exam") {
    await handleUniversity(userId, chatId, parsed)
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
        .map((button) => ({
          text: button.text,
          data: button.callback_data ?? "",
        }))
    )
    .filter((row) => row.length > 0)

  return kept.length ? kept : undefined
}

/** يشطب سطر المهمة في نص الملخص بعلامة، فيبقى السياق مرئياً */
function markLine(text: string, title: string, mark: string): string {
  return text
    .split("\n")
    .map((row) =>
      row.includes(title) && !row.startsWith(mark) ? `${mark} ${row}` : row
    )
    .join("\n")
}

/**
 * أكواد الأزرار: الحرف الأول نوع السجل («a» للواجب، لا شيء للمهمة)
 * والأخير الفعل («d» إنجاز، «p» تأجيل). مثال: `ad:<id>` = إنجاز واجب.
 *
 * البادئة القصيرة مقصودة: حدّ callback_data ٦٤ بايت، والـ cuid وحده ٢٥.
 */
type ItemRef = { table: "task" | "assignment"; verb: "d" | "p"; id: string }

function parseCallback(data: string): ItemRef | null {
  const [action, id] = data.split(":")
  if (!id) return null

  const table = action.startsWith("a") ? "assignment" : "task"
  const verb = action.endsWith("p") ? "p" : action.endsWith("d") ? "d" : null
  if (!verb) return null

  return { table, verb, id }
}

export async function handleCallback(
  userId: string,
  callback: NonNullable<TelegramUpdate["callback_query"]>
) {
  const data = callback.data ?? ""
  const message = callback.message

  // ربط ملف أرشيف بمادة — شكله مختلف عن أزرار الإنجاز والتأجيل
  if (data.startsWith("as:") && message) {
    const [, fileId, subjectId] = data.split(":")

    try {
      const linked = await linkArchiveSubject(userId, fileId, subjectId)
      await answerCallback(callback.id, `📚 ${linked.subject}`)
      await editMessage({
        chatId: String(message.chat.id),
        messageId: message.message_id,
        text: `📎 أُرشف: ${linked.title}
📚 ${linked.subject}`,
      })
    } catch (error) {
      console.error("telegram: فشل ربط الملف بمادة", error)
      await answerCallback(callback.id, "تعذّر الربط")
    }
    return
  }

  const ref = parseCallback(data)

  if (!ref || !message) {
    await answerCallback(callback.id)
    return
  }

  const chatId = String(message.chat.id)

  const record =
    ref.table === "task"
      ? await db.task.findFirst({
          where: { id: ref.id, userId },
          select: { title: true },
        })
      : await db.assignment.findFirst({
          where: { id: ref.id, userId },
          select: { title: true },
        })

  if (!record) {
    await answerCallback(callback.id, "لم أجد هذا السجل")
    return
  }

  try {
    let toast: string
    let mark: string

    if (ref.verb === "d") {
      mark = "✅"
      if (ref.table === "task") {
        const { spawned } = await setTaskDoneFor(userId, ref.id, true)
        toast = spawned ? "✓ أُنجزت، وأُنشئت النسخة التالية" : "✓ أُنجزت"
      } else {
        await setAssignmentStatusFor(userId, ref.id, "DONE")
        toast = "✓ أُنجز الواجب"
      }
    } else {
      mark = "⏰"
      const { dueDate } =
        ref.table === "task"
          ? await postponeTaskFor(userId, ref.id, 1)
          : await postponeAssignmentFor(userId, ref.id, 1)

      const label =
        dueDate === todayISO() ? "اليوم" : formatDateShort(dueDate, "ar")
      // «المهمة أُجّلت» و«الواجب أُجّل» — التذكير والتأنيث يتبع نوع السجل
      const verb = ref.table === "task" ? "أُجّلت" : "أُجّل"
      toast = `⏰ ${verb} إلى ${label}`
    }

    await answerCallback(callback.id, toast)

    if (message.text) {
      await editMessage({
        chatId,
        messageId: message.message_id,
        text: markLine(message.text, record.title, mark),
        buttons: keyboardWithout(message.reply_markup, ref.id),
      })
    }
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
