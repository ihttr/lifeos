import "server-only"

import { db } from "@/lib/db"
import {
  dateColumnToISO,
  endOfMonthISO,
  startOfWeekISO,
  toISODateInTZ,
  todayISO,
} from "@/lib/dates"
import { percentOf } from "@/lib/format"
import { requireUserId } from "@/server/auth"
import { getUpcoming } from "@/server/queries/agenda"
import { getActiveProjects } from "@/server/queries/projects"
import { getTaskCounts, getTodayTasks } from "@/server/queries/tasks"

import type { WidgetId } from "@/components/dashboard/widgets"

/** أهداف نشطة مع نسبة إنجازها */
async function getActiveGoals(limit = 3) {
  const userId = await requireUserId()

  const goals = await db.goal.findMany({
    where: { userId, status: "ACTIVE" },
    select: {
      id: true,
      title: true,
      category: true,
      deadline: true,
      milestones: { select: { done: true } },
    },
    orderBy: [{ deadline: { sort: "asc", nulls: "last" } }],
    take: limit,
  })

  return goals.map((goal) => {
    const done = goal.milestones.filter((m) => m.done).length
    return {
      id: goal.id,
      title: goal.title,
      category: goal.category,
      deadline: dateColumnToISO(goal.deadline),
      total: goal.milestones.length,
      done,
      progress: percentOf(done, goal.milestones.length),
    }
  })
}

async function getFocusSummary() {
  const userId = await requireUserId()

  const today = todayISO()
  const dayStart = new Date(`${today}T00:00:00.000+03:00`)
  const weekStart = new Date(`${startOfWeekISO(today)}T00:00:00.000+03:00`)

  const [week, day] = await Promise.all([
    db.focusSession.aggregate({
      where: { userId, type: "WORK", startedAt: { gte: weekStart } },
      _sum: { durationSec: true },
    }),
    db.focusSession.aggregate({
      where: { userId, type: "WORK", startedAt: { gte: dayStart } },
      _sum: { durationSec: true },
    }),
  ])

  return {
    weekSec: week._sum.durationSec ?? 0,
    todaySec: day._sum.durationSec ?? 0,
  }
}

async function getProjectCount() {
  const userId = await requireUserId()
  return db.project.count({ where: { userId, status: "IN_PROGRESS" } })
}

/** الواجبات والاختبارات القادمة من الفصل النشط */
async function getUniversitySnapshot(limit = 4) {
  const userId = await requireUserId()
  const now = new Date()

  const [assignments, exams] = await Promise.all([
    db.assignment.findMany({
      where: {
        userId,
        status: { not: "DONE" },
        subject: { semester: { isActive: true } },
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        subject: { select: { name: true, color: true } },
      },
      orderBy: { dueDate: "asc" },
      take: limit,
    }),
    db.exam.findMany({
      where: {
        userId,
        date: { gte: now },
        subject: { semester: { isActive: true } },
      },
      select: {
        id: true,
        title: true,
        date: true,
        subject: { select: { name: true, color: true } },
      },
      orderBy: { date: "asc" },
      take: 2,
    }),
  ])

  return {
    assignments: assignments.map((row) => ({
      id: row.id,
      title: row.title,
      date: toISODateInTZ(row.dueDate),
      subject: row.subject.name,
      color: row.subject.color,
    })),
    exams: exams.map((row) => ({
      id: row.id,
      title: row.title,
      date: toISODateInTZ(row.date),
      subject: row.subject.name,
      color: row.subject.color,
    })),
  }
}

/** ملخص الشهر الحالي */
async function getFinanceSnapshot() {
  const userId = await requireUserId()
  const month = todayISO().slice(0, 7)

  const grouped = await db.transaction.groupBy({
    by: ["type"],
    where: {
      userId,
      date: {
        gte: new Date(`${month}-01T00:00:00.000Z`),
        lte: new Date(`${endOfMonthISO(`${month}-01`)}T23:59:59.999Z`),
      },
    },
    _sum: { amount: true },
  })

  const income = Number(grouped.find((g) => g.type === "INCOME")?._sum.amount ?? 0)
  const expense = Number(
    grouped.find((g) => g.type === "EXPENSE")?._sum.amount ?? 0
  )

  return { month, income, expense, balance: income - expense }
}

/**
 * المسارات النشطة مع الدرس التالي غير المنجز.
 * الدرس التالي هو ما يجعل البطاقة قابلة للتنفيذ لا مجرد شريط تقدم.
 */
async function getLearningSnapshot(limit = 3) {
  const userId = await requireUserId()

  const paths = await db.learningPath.findMany({
    where: { userId, status: "ACTIVE" },
    select: {
      id: true,
      title: true,
      color: true,
      sections: {
        select: {
          position: true,
          lessons: {
            select: { title: true, done: true, position: true },
            orderBy: { position: "asc" },
          },
        },
        orderBy: { position: "asc" },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  })

  return paths.map((path) => {
    const lessons = path.sections.flatMap((section) => section.lessons)
    const done = lessons.filter((lesson) => lesson.done).length

    return {
      id: path.id,
      title: path.title,
      color: path.color,
      total: lessons.length,
      done,
      progress: percentOf(done, lessons.length),
      nextLesson: lessons.find((lesson) => !lesson.done)?.title ?? null,
    }
  })
}

async function getRecentNotes(limit = 4) {
  const userId = await requireUserId()

  const notes = await db.note.findMany({
    where: { userId, archivedAt: null },
    select: { id: true, title: true, category: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    take: limit,
  })

  return notes.map((note) => ({
    ...note,
    updatedAt: note.updatedAt.toISOString(),
  }))
}

/**
 * يجلب ما تحتاجه البطاقات الظاهرة فقط.
 *
 * البطاقة المخفية لا تُكلّف استعلاماً — وهذا سبب تمرير القائمة
 * بدل جلب كل شيء ثم إخفاء بعضه في الواجهة.
 */
export async function getDashboardData(widgets: WidgetId[]) {
  const enabled = new Set(widgets)

  const [
    counts,
    todayTasks,
    upcoming,
    projects,
    goals,
    focus,
    activeProjects,
    university,
    learning,
    finance,
    notes,
  ] = await Promise.all([
    enabled.has("stats") ? getTaskCounts() : null,
    enabled.has("todayTasks") ? getTodayTasks() : null,
    enabled.has("upcoming") ? getUpcoming(14, 6) : null,
    enabled.has("projects") ? getActiveProjects(3) : null,
    enabled.has("goals") ? getActiveGoals(3) : null,
    enabled.has("stats") || enabled.has("focus") ? getFocusSummary() : null,
    enabled.has("stats") ? getProjectCount() : null,
    enabled.has("university") ? getUniversitySnapshot() : null,
    enabled.has("learning") ? getLearningSnapshot() : null,
    enabled.has("finance") ? getFinanceSnapshot() : null,
    enabled.has("notes") ? getRecentNotes() : null,
  ])

  return {
    counts,
    todayTasks,
    upcoming,
    projects,
    goals,
    focus,
    activeProjects,
    university,
    learning,
    finance,
    notes,
  }
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>
