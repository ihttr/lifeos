import "server-only"

import { db } from "@/lib/db"
import { dateColumnToISO, startOfWeekISO, todayISO } from "@/lib/dates"
import { percentOf } from "@/lib/format"
import { requireUserId } from "@/server/auth"
import { getUpcoming } from "@/server/queries/agenda"
import { getActiveProjects } from "@/server/queries/projects"
import { getTaskCounts, getTodayTasks } from "@/server/queries/tasks"

/** أهداف نشطة مع نسبة إنجازها — تكفي للوحة التحكم */
async function getActiveGoals(limit = 4) {
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

  return goals.map((goal) => ({
    id: goal.id,
    title: goal.title,
    category: goal.category,
    deadline: dateColumnToISO(goal.deadline),
    total: goal.milestones.length,
    done: goal.milestones.filter((m) => m.done).length,
    progress: percentOf(
      goal.milestones.filter((m) => m.done).length,
      goal.milestones.length
    ),
  }))
}

/** ثوانِ التركيز هذا الأسبوع وهذا اليوم */
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

/**
 * كل ما تحتاجه لوحة التحكم في استعلام واحد متوازٍ.
 * الهدف: الإجابة فوراً على "ما الذي عليّ فعله اليوم؟".
 */
export async function getDashboardData() {
  const [counts, todayTasks, upcoming, projects, goals, focus, activeProjects] =
    await Promise.all([
      getTaskCounts(),
      getTodayTasks(),
      getUpcoming(14, 6),
      getActiveProjects(3),
      getActiveGoals(3),
      getFocusSummary(),
      getProjectCount(),
    ])

  return {
    counts,
    todayTasks,
    upcoming,
    projects,
    goals,
    focus,
    activeProjects,
  }
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>
