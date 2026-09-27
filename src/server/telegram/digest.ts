import "server-only"

import { db } from "@/lib/db"
import { arabicDays } from "@/lib/format"
import { getNotificationsFor } from "@/server/queries/notifications"

import type { InlineButton } from "@/lib/telegram"
import type { AgendaKind } from "@/server/queries/agenda"
import type { NotificationDTO } from "@/server/queries/notifications"

/**
 * يبني رسالة الملخص من الإشعارات المشتقة أصلاً.
 *
 * النص عادي بلا HTML عن قصد: عند الضغط على زر نحرّر الرسالة نفسها،
 * وتيليجرام يعطينا النص المُصاغ لا المصدر — فأي تنسيق سيضيع في أول
 * تحرير. الإيموجي يقوم بدور العناوين ويبقى سليماً بعد أي عدد من التحريرات.
 */

/**
 * ستة أزواج أزرار = ثلاثة صفوف على الجوال. أكثر من ذلك جدار لا ملخص،
 * وما زاد يبقى في النص بلا زر — يُفتح من التطبيق.
 */
const MAX_BUTTON_TASKS = 6

/** زوجان في الصف: الملصق قصير («✅ 1») فيتّسع أربعة أزرار بلا قصّ */
const TASKS_PER_ROW = 2

const KIND_ICON: Record<AgendaKind, string> = {
  task: "☐",
  assignment: "📝",
  exam: "📕",
  project: "📦",
  goal: "🎯",
}

const WEEKDAY_NAMES = [
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
]

function whenLabel(item: NotificationDTO): string {
  if (item.days < 0) return `متأخر ${arabicDays(-item.days)}`
  if (item.days === 0) return item.kind === "exam" ? "اليوم" : ""
  if (item.days === 1) return "غداً"
  if (item.days === 2) return "بعد يومين"

  const date = new Date(Date.now() + item.days * 86_400_000)
  return WEEKDAY_NAMES[date.getUTCDay()]
}

/**
 * الرقم هو علامة «له زر»، والأيقونة علامة «للعلم فقط».
 * فلا نجمعهما: سطر مرقّم بلا أيقونة، وسطر بأيقونة بلا رقم — وإلا
 * ظهرت السطور غير المرقّمة كأن رقمها سقط.
 */
function line(item: NotificationDTO, index: number | null): string {
  const parts: string[] = []
  if (index !== null) parts.push(`${index}.`)
  else parts.push(KIND_ICON[item.kind])
  parts.push(item.title)

  const extras = [item.context, whenLabel(item)].filter(Boolean)
  const suffix = extras.length ? ` — ${extras.join(" · ")}` : ""

  return `${parts.join(" ")}${suffix}`
}

export type Digest = {
  text: string
  buttons: InlineButton[][]
  /** مفاتيح العناصر القادمة التي دخلت هذه الرسالة — تُسجّل بعد نجاح الإرسال */
  soonKeys: string[]
}

/**
 * @param includeSoon القادم يُدرج في الملخص الصباحي مرة واحدة فقط،
 *   ويُدرج دائماً عند طلب `/today` يدوياً.
 */
export async function buildDigest(
  userId: string,
  {
    greeting,
    includeSoon,
    skipSentSoon,
  }: { greeting: string; includeSoon: boolean; skipSentSoon: boolean }
): Promise<Digest | null> {
  const notifications = await getNotificationsFor(userId)

  const overdue = notifications.filter((n) => n.level === "overdue")
  const today = notifications.filter((n) => n.level === "today")
  let soon = includeSoon
    ? notifications.filter((n) => n.level === "soon")
    : []

  if (soon.length && skipSentSoon) {
    const sent = await db.telegramSent.findMany({
      where: { userId, key: { in: soon.map((n) => n.key) } },
      select: { key: true },
    })
    const sentKeys = new Set(sent.map((row) => row.key))
    soon = soon.filter((n) => !sentKeys.has(n.key))
  }

  if (!overdue.length && !today.length && !soon.length) return null

  // الترقيم مشترك بين المتأخر واليوم، لأن الأزرار تشير إليه.
  //
  // نقسم الأزرار بين القسمين بدل أن يأخذ المتأخر كلها: كومة متأخرات
  // كبيرة تترك مهام اليوم بلا زر، وهي أَولى بالتنفيذ لأن وقتها لم يفت.
  // وما لا يستهلكه قسمٌ يذهب للآخر، فلا يُهدر زر.
  // الواجبات تُنجَز وتُؤجَّل مثل المهام، فتستحق أزرارها. الاختبارات
  // والمشاريع والأهداف لا — لا معنى لـ«أنجزت اختباراً» من إشعار.
  const canAct = (n: NotificationDTO) =>
    n.kind === "task" || n.kind === "assignment"

  const overdueTasks = overdue.filter(canAct)
  const todayTasks = today.filter(canAct)
  const half = Math.ceil(MAX_BUTTON_TASKS / 2)

  const overdueQuota = Math.min(
    overdueTasks.length,
    Math.max(half, MAX_BUTTON_TASKS - todayTasks.length)
  )

  const actionable: NotificationDTO[] = [
    ...overdueTasks.slice(0, overdueQuota),
    ...todayTasks.slice(0, MAX_BUTTON_TASKS - overdueQuota),
  ]

  const numberOf = new Map(actionable.map((n, i) => [n.key, i + 1]))

  const sections: string[] = [greeting]

  if (overdue.length) {
    sections.push(
      ["", "⚠️ متأخر", ...overdue.map((n) => line(n, numberOf.get(n.key) ?? null))].join("\n")
    )
  }

  if (today.length) {
    sections.push(
      ["", "📌 اليوم", ...today.map((n) => line(n, numberOf.get(n.key) ?? null))].join("\n")
    )
  }

  if (soon.length) {
    sections.push(["", "🔜 القادم", ...soon.map((n) => line(n, null))].join("\n"))
  }

  const pairs: InlineButton[][] = actionable.map((item, index) => {
    // مفتاح الإشعار = `<kind>:<cuid>:<days>` — نستخرج الـ cuid للزر
    const id = item.key.split(":")[1]
    // بادئة «a» تميّز الواجب عن المهمة عند عودة الضغطة
    const prefix = item.kind === "assignment" ? "a" : ""
    return [
      { text: `✅ ${index + 1}`, data: `${prefix}d:${id}` },
      { text: `⏰ ${index + 1}`, data: `${prefix}p:${id}` },
    ]
  })

  const buttons: InlineButton[][] = []
  for (let i = 0; i < pairs.length; i += TASKS_PER_ROW) {
    buttons.push(pairs.slice(i, i + TASKS_PER_ROW).flat())
  }

  if (buttons.length) {
    sections.push("\n✅ أنجزتها · ⏰ أجّلها يوماً")
  }

  return {
    text: sections.join("\n"),
    buttons,
    soonKeys: soon.map((n) => n.key),
  }
}

/** يسجّل ما أُرسل من القادم حتى لا يتكرر غداً */
export async function markSoonSent(userId: string, keys: string[]) {
  if (!keys.length) return

  await db.telegramSent.createMany({
    data: keys.map((key) => ({ userId, key })),
    skipDuplicates: true,
  })
}
