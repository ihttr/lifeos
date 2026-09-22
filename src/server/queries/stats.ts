import "server-only"

import { db } from "@/lib/db"
import { addDaysISO, todayISO } from "@/lib/dates"
import { percentOf } from "@/lib/format"
import { requireUserId } from "@/server/auth"

export type StatsRange = 7 | 30 | 90 | 365

export type DayPoint = { date: string; created: number; completed: number }

function dayStart(iso: string): Date {
  return new Date(`${iso}T00:00:00.000+03:00`)
}

const riyadhDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Riyadh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

/**
 * إحصاءات المدى المختار.
 *
 * نجمع بتوقيت الرياض لا UTC، وإلا ظهرت مهمة أُنجزت الساعة الواحدة ليلاً
 * في اليوم السابق. المدى الطويل (سنة) يُجمَّع أسبوعياً حتى لا نرسم ٣٦٥ عموداً.
 */
export async function getStats(days: StatsRange) {
  const userId = await requireUserId()
  const today = todayISO()
  const start = addDaysISO(today, -(days - 1))
  const startDate = dayStart(start)

  const [
    createdTasks,
    completedTasks,
    focusSessions,
    projectsCompleted,
    goalsCompleted,
    lessonsDone,
    transactions,
    assignmentsDone,
    openTasks,
    totalGoals,
  ] = await Promise.all([
    db.task.findMany({
      where: { userId, createdAt: { gte: startDate } },
      select: { createdAt: true },
    }),
    db.task.findMany({
      where: { userId, completedAt: { gte: startDate } },
      select: { completedAt: true },
    }),
    db.focusSession.findMany({
      where: { userId, type: "WORK", startedAt: { gte: startDate } },
      select: { startedAt: true, durationSec: true },
    }),
    db.project.count({
      where: { userId, status: "COMPLETED", updatedAt: { gte: startDate } },
    }),
    db.goal.count({
      where: { userId, status: "COMPLETED", updatedAt: { gte: startDate } },
    }),
    db.learningLesson.count({
      where: {
        done: true,
        doneAt: { gte: startDate },
        section: { learningPath: { userId } },
      },
    }),
    db.transaction.findMany({
      where: { userId, date: { gte: new Date(`${start}T00:00:00.000Z`) } },
      select: { amount: true, type: true },
    }),
    db.assignment.count({
      where: { userId, status: "DONE", updatedAt: { gte: startDate } },
    }),
    db.task.count({ where: { userId, archivedAt: null, status: { not: "DONE" } } }),
    db.goal.count({ where: { userId } }),
  ])

  // سلسلة يومية
  const byDay = new Map<string, { created: number; completed: number }>()
  for (let cursor = start; cursor <= today; cursor = addDaysISO(cursor, 1)) {
    byDay.set(cursor, { created: 0, completed: 0 })
  }

  for (const task of createdTasks) {
    const bucket = byDay.get(riyadhDay.format(task.createdAt))
    if (bucket) bucket.created += 1
  }
  for (const task of completedTasks) {
    if (!task.completedAt) continue
    const bucket = byDay.get(riyadhDay.format(task.completedAt))
    if (bucket) bucket.completed += 1
  }

  let series: DayPoint[] = [...byDay.entries()].map(([date, value]) => ({
    date,
    ...value,
  }))

  // المدى السنوي يُجمَّع أسبوعياً
  if (days > 90) {
    const weeks: DayPoint[] = []
    for (let i = 0; i < series.length; i += 7) {
      const chunk = series.slice(i, i + 7)
      weeks.push({
        date: chunk[0].date,
        created: chunk.reduce((sum, d) => sum + d.created, 0),
        completed: chunk.reduce((sum, d) => sum + d.completed, 0),
      })
    }
    series = weeks
  }

  const focusSec = focusSessions.reduce((sum, s) => sum + s.durationSec, 0)
  const income = transactions
    .filter((t) => t.type === "INCOME")
    .reduce((sum, t) => sum + Number(t.amount), 0)
  const expense = transactions
    .filter((t) => t.type === "EXPENSE")
    .reduce((sum, t) => sum + Number(t.amount), 0)

  const created = createdTasks.length
  const completed = completedTasks.length

  return {
    range: days,
    series,
    grouped: days > 90,
    tasks: {
      created,
      completed,
      // نسبة الإنجاز مقارنةً بما أُنشئ في المدى نفسه
      rate: percentOf(completed, Math.max(created, completed)),
      open: openTasks,
    },
    focus: {
      seconds: focusSec,
      sessions: focusSessions.length,
      dailyAverage: Math.round(focusSec / days),
    },
    projectsCompleted,
    goalsCompleted,
    totalGoals,
    lessonsDone,
    assignmentsDone,
    finance: { income, expense, balance: income - expense },
  }
}

export type StatsData = Awaited<ReturnType<typeof getStats>>
