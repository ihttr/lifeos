import "server-only"

import { db } from "@/lib/db"
import { dateColumnToISO } from "@/lib/dates"
import { percentOf } from "@/lib/format"
import { requireUserId } from "@/server/auth"

import type { Prisma } from "@/generated/prisma/client"
import type { GoalFilters } from "@/schemas/goal"

export type GoalDTO = {
  id: string
  title: string
  description: string | null
  category: string | null
  deadline: string | null
  status: "ACTIVE" | "COMPLETED" | "PAUSED"
  milestones: { id: string; title: string; done: boolean; position: number }[]
  doneCount: number
  progress: number
}

export async function getGoals(filters: GoalFilters = {}): Promise<GoalDTO[]> {
  const userId = await requireUserId()

  const where: Prisma.GoalWhereInput = { userId }
  if (filters.status) where.status = filters.status
  if (filters.category) where.category = filters.category

  const goals = await db.goal.findMany({
    where,
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      deadline: true,
      status: true,
      milestones: {
        select: { id: true, title: true, done: true, position: true },
        orderBy: { position: "asc" },
      },
    },
    orderBy: [
      { status: "asc" },
      { deadline: { sort: "asc", nulls: "last" } },
      { createdAt: "desc" },
    ],
    take: 200,
  })

  return goals.map((goal) => {
    const doneCount = goal.milestones.filter((m) => m.done).length

    return {
      ...goal,
      deadline: dateColumnToISO(goal.deadline),
      doneCount,
      // الهدف المكتمل يُعرض ١٠٠٪ حتى لو لم تُسجَّل له مراحل
      progress:
        goal.status === "COMPLETED"
          ? 100
          : percentOf(doneCount, goal.milestones.length),
    }
  })
}

/** التصنيفات المستخدمة — لقائمة التصفية واقتراحات النموذج */
export async function getGoalCategories(): Promise<string[]> {
  const userId = await requireUserId()

  const rows = await db.goal.findMany({
    where: { userId, category: { not: null } },
    select: { category: true },
    distinct: ["category"],
    take: 50,
  })

  return rows
    .map((row) => row.category)
    .filter((value): value is string => Boolean(value))
    .sort()
}

export async function getGoalSummary() {
  const userId = await requireUserId()

  const [active, completed, paused] = await Promise.all([
    db.goal.count({ where: { userId, status: "ACTIVE" } }),
    db.goal.count({ where: { userId, status: "COMPLETED" } }),
    db.goal.count({ where: { userId, status: "PAUSED" } }),
  ])

  return { active, completed, paused }
}
