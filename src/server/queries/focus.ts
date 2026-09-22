import "server-only"

import { db } from "@/lib/db"
import { addDaysISO, startOfWeekISO, todayISO } from "@/lib/dates"
import { requireUserId } from "@/server/auth"

/** بداية يوم بتوقيت الرياض كلحظة UTC */
function dayStart(iso: string): Date {
  return new Date(`${iso}T00:00:00.000+03:00`)
}

export type FocusDay = { date: string; seconds: number; sessions: number }

export async function getFocusData() {
  const userId = await requireUserId()

  const today = todayISO()
  const weekStart = startOfWeekISO(today)
  // ثمانية وعشرون يوماً تكفي لرسم اتجاه واضح بلا إثقال الاستعلام
  const rangeStart = addDaysISO(today, -27)

  const [sessions, settings, recent] = await Promise.all([
    db.focusSession.findMany({
      where: {
        userId,
        type: "WORK",
        startedAt: { gte: dayStart(rangeStart) },
      },
      select: { startedAt: true, durationSec: true },
      orderBy: { startedAt: "asc" },
    }),
    db.user.findUnique({
      where: { id: userId },
      select: {
        pomodoroWorkMin: true,
        pomodoroBreakMin: true,
        pomodoroLongBreakMin: true,
        pomodoroUntilLong: true,
      },
    }),
    db.focusSession.findMany({
      where: { userId, type: "WORK" },
      select: {
        id: true,
        startedAt: true,
        durationSec: true,
        task: { select: { id: true, title: true } },
      },
      orderBy: { startedAt: "desc" },
      take: 8,
    }),
  ])

  // تجميع يومي بتوقيت الرياض
  const byDay = new Map<string, { seconds: number; sessions: number }>()
  for (let cursor = rangeStart; cursor <= today; cursor = addDaysISO(cursor, 1)) {
    byDay.set(cursor, { seconds: 0, sessions: 0 })
  }

  const dayFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })

  for (const session of sessions) {
    const key = dayFormatter.format(session.startedAt)
    const bucket = byDay.get(key)
    if (!bucket) continue
    bucket.seconds += session.durationSec
    bucket.sessions += 1
  }

  const days: FocusDay[] = [...byDay.entries()].map(([date, value]) => ({
    date,
    ...value,
  }))

  const todaySec = byDay.get(today)?.seconds ?? 0
  const weekSec = days
    .filter((day) => day.date >= weekStart)
    .reduce((sum, day) => sum + day.seconds, 0)
  const monthSec = days.reduce((sum, day) => sum + day.seconds, 0)
  const todaySessions = byDay.get(today)?.sessions ?? 0

  // أطول سلسلة أيام متصلة انتهت اليوم أو أمس
  let streak = 0
  for (let cursor = today; ; cursor = addDaysISO(cursor, -1)) {
    const bucket = byDay.get(cursor)
    if (!bucket) break
    if (bucket.seconds === 0) {
      // يوم اليوم لا يكسر السلسلة قبل أن يبدأ
      if (cursor === today) continue
      break
    }
    streak += 1
  }

  return {
    days,
    todaySec,
    weekSec,
    monthSec,
    todaySessions,
    streak,
    settings: settings ?? {
      pomodoroWorkMin: 25,
      pomodoroBreakMin: 5,
      pomodoroLongBreakMin: 15,
      pomodoroUntilLong: 4,
    },
    recent: recent.map((session) => ({
      id: session.id,
      startedAt: session.startedAt.toISOString(),
      durationSec: session.durationSec,
      task: session.task,
    })),
  }
}

export type FocusData = Awaited<ReturnType<typeof getFocusData>>

/** المهام المفتوحة — لربط الجلسة بما تعمل عليه */
export async function getFocusTaskOptions() {
  const userId = await requireUserId()

  return db.task.findMany({
    where: { userId, archivedAt: null, status: { not: "DONE" } },
    select: { id: true, title: true },
    orderBy: [{ priority: "desc" }, { dueDate: { sort: "asc", nulls: "last" } }],
    take: 50,
  })
}
